import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { enrichCandidate } from './ai';
import { createSubmission, getCategoryId, isKnownBusiness, logOutcome, selectNextTarget } from './db';
import { discoverFromFacebook, discoverFromYelp, filterCandidates } from './sources';
import { BusinessCandidate, Env, VerificationResult } from './types';

interface DiscoveryParams { runDate: string }
interface VerificationParams { candidate: BusinessCandidate }

export class BusinessDiscoveryWorkflow extends WorkflowEntrypoint<Env, DiscoveryParams> {
  async run(event: WorkflowEvent<DiscoveryParams>, step: WorkflowStep): Promise<void> {
    if (!(await isDiscoveryEnabled(this.env))) {
      console.log('Discovery workflow skipped because the feature flag is disabled');
      return;
    }
    const target = await step.do('select target', () => selectNextTarget(this.env));
    const candidates = await step.do('discover candidates', async (): Promise<BusinessCandidate[]> => {
      const [yelpResult, facebookResult] = await Promise.allSettled([
        discoverFromYelp(target, this.env),
        discoverFromFacebook(target, this.env),
      ]);
      const yelp = yelpResult.status === 'fulfilled' ? yelpResult.value : [];
      const facebook = facebookResult.status === 'fulfilled' ? facebookResult.value : [];
      if (yelpResult.status === 'rejected') console.warn('Yelp discovery failed; continuing with Facebook', yelpResult.reason);
      if (facebookResult.status === 'rejected') console.warn('Facebook discovery failed; continuing with Yelp', facebookResult.reason);
      const seen = new Set<string>();
      const limit = Number(this.env.MAX_DAILY_DISCOVERIES);
      if (!Number.isInteger(limit) || limit < 1) throw new Error('MAX_DAILY_DISCOVERIES must be a positive integer');
      return filterCandidates([...yelp, ...facebook], this.env).filter((candidate) => {
        const key = `${candidate.name.toLowerCase()}|${candidate.city.toLowerCase()}|${candidate.state}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);
    });

    await step.do('enqueue candidates', async () => {
      if (candidates.length > 0) await this.env.DISCOVERY_QUEUE.sendBatch(candidates.map((body) => ({ body })));
      return { target, discovered: candidates.length, runDate: event.payload.runDate };
    });
  }
}

export class VerificationWorkflow extends WorkflowEntrypoint<Env, VerificationParams> {
  async run(event: WorkflowEvent<VerificationParams>, step: WorkflowStep): Promise<void> {
    const { candidate } = event.payload;
    const duplicate = await step.do('check known businesses', () => isKnownBusiness(candidate, this.env));
    if (duplicate) {
      await step.do('log duplicate', () => logOutcome(candidate, 'duplicate', null, { candidate }, this.env));
      return;
    }

    const enrichment = await step.do('enrich candidate', () => enrichCandidate(candidate, this.env));
    const verification = await step.do('independent verification', async (): Promise<VerificationResult> => {
      if (!this.env.VERIFIER_SHARED_SECRET) throw new Error('VERIFIER_SHARED_SECRET is not configured');
      const response = await this.env.VERIFIER.fetch('https://verifier.internal/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Verifier-Secret': this.env.VERIFIER_SHARED_SECRET,
        },
        body: JSON.stringify({ candidate, enrichment }),
      });
      if (!response.ok) throw new Error(`Verifier returned ${response.status}`);
      return await response.json<VerificationResult>();
    });

    const confidence = Math.min(enrichment.confidence, verification.confidence);
    if (verification.verdict === 'reject' || confidence < 0.5) {
      await step.do('log rejected candidate', () => logOutcome(candidate, 'rejected', confidence, { enrichment, verification }, this.env));
      return;
    }

    const categoryId = await step.do('resolve category', () => getCategoryId(enrichment.categorySlug, this.env));
    if (!categoryId) {
      await step.do('log category failure', () => logOutcome(candidate, 'rejected', confidence, { enrichment, verification, reason: 'unknown_category' }, this.env));
      return;
    }

    // Phase 1 is intentionally submissions-only. Admin approval remains the
    // only path that can create a public listing.
    const submissionId = await step.do('create admin submission', () =>
      createSubmission(candidate, categoryId, enrichment, verification, confidence, this.env),
    );
    await step.do('log submitted candidate', () =>
      logOutcome(candidate, 'submitted', confidence, { enrichment, verification }, this.env, submissionId),
    );
  }
}

async function isDiscoveryEnabled(env: Env): Promise<boolean> {
  if (env.DISCOVERY_ENABLED === 'true') return true;
  try {
    return await env.FLAGS.getBooleanValue('enable-business-discovery', false);
  } catch (error) {
    console.warn('Discovery feature flag evaluation failed; defaulting to disabled', error);
    return false;
  }
}
