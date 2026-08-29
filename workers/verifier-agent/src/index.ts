interface Env {
  AI: Ai;
  FLAGS: Flagship;
  VERIFIER_SHARED_SECRET?: string;
}

interface Candidate {
  name: string;
  rating: number;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  facebookUrl: string | null;
  address: string | null;
  city: string;
  state: 'OK' | 'TX' | 'AR';
  source: string;
  sourceUrl: string | null;
  evidence: Record<string, unknown>;
}

interface Enrichment {
  categorySlug: string;
  description: string;
  confidence: number;
  reasoning: string;
}

interface VerifyRequest {
  candidate: Candidate;
  enrichment: Enrichment;
}

interface VerificationResult {
  verdict: 'approve' | 'review' | 'reject';
  confidence: number;
  discrepancies: string[];
  reasoning: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'healthy' });
    if (url.pathname !== '/verify' || request.method !== 'POST') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (!env.VERIFIER_SHARED_SECRET || request.headers.get('X-Verifier-Secret') !== env.VERIFIER_SHARED_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = await request.json<VerifyRequest>();
      if (!isVerifyRequest(body)) return Response.json({ error: 'Invalid verification request' }, { status: 400 });
      return Response.json(await verify(body, env));
    } catch (error) {
      console.error('Verification failed', error);
      return Response.json({ error: 'Verification failed' }, { status: 500 });
    }
  },
};

async function verify({ candidate, enrichment }: VerifyRequest, env: Env): Promise<VerificationResult> {
  const discrepancies: string[] = [];
  if (candidate.rating < 4 || candidate.reviewCount < 5) discrepancies.push('Does not satisfy the minimum rating or review-count policy.');
  if (!['OK', 'TX', 'AR'].includes(candidate.state)) discrepancies.push('Business is outside the supported service region.');
  if (candidate.phone && !isRegionalPhone(candidate.phone)) discrepancies.push('Phone number does not use a recognized regional area code.');

  const websiteEvidence = await fetchWebsiteEvidence(candidate.website);
  if (candidate.website && !websiteEvidence.reachable) discrepancies.push('Website could not be reached for independent verification.');
  if (websiteEvidence.title && !looselyMatchesBusinessName(websiteEvidence.title, candidate.name)) {
    discrepancies.push('Website title does not appear to match the business name.');
  }

  const prompt = `You are an independent verifier for a local business directory. Evaluate only supplied evidence. Do not infer facts from a business name. A Yelp or Facebook source record alone supports a review, not automatic publication.

Candidate:
${JSON.stringify(candidate)}

First-pass enrichment:
${JSON.stringify(enrichment)}

Independent website evidence:
${JSON.stringify(websiteEvidence)}

Deterministic discrepancies:
${JSON.stringify(discrepancies)}

Return JSON only: {"verdict":"approve"|"review"|"reject","confidence":0.0,"discrepancies":["..."],"reasoning":"brief evidence-based explanation"}.
Use reject for demonstrably invalid or out-of-region businesses. Use review when evidence is incomplete or contradictory. Use approve only when source identity, location, rating, and business details agree.`;
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt, max_tokens: 500 }) as { response?: string } | string;
  const result = parseResult(response);
  return {
    verdict: discrepancies.some((issue) => issue.includes('outside')) ? 'reject' : result.verdict,
    confidence: clamp(result.confidence),
    discrepancies: [...new Set([...discrepancies, ...result.discrepancies])],
    reasoning: result.reasoning,
  };
}

async function fetchWebsiteEvidence(website: string | null): Promise<{ reachable: boolean; title: string | null }> {
  if (!website) return { reachable: false, title: null };
  try {
    const response = await fetch(website, { redirect: 'follow', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return { reachable: false, title: null };
    const html = (await response.text()).slice(0, 50_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
    return { reachable: true, title };
  } catch {
    return { reachable: false, title: null };
  }
}

function isRegionalPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return ['580', '918', '903', '430', '870'].includes(digits.slice(0, 3));
}

function looselyMatchesBusinessName(title: string, name: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
  const titleWords = new Set(normalize(title));
  return normalize(name).some((word) => titleWords.has(word));
}

function parseResult(response: { response?: string } | string): VerificationResult {
  const text = typeof response === 'string' ? response : response.response ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Workers AI did not return JSON');
  const parsed = JSON.parse(match[0]) as Partial<VerificationResult>;
  if (!['approve', 'review', 'reject'].includes(parsed.verdict ?? '') || typeof parsed.confidence !== 'number' ||
    !Array.isArray(parsed.discrepancies) || typeof parsed.reasoning !== 'string') {
    throw new Error('Workers AI returned an invalid verification response');
  }
  return parsed as VerificationResult;
}

function isVerifyRequest(value: unknown): value is VerifyRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<VerifyRequest>;
  return Boolean(request.candidate && request.enrichment && typeof request.candidate.name === 'string');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
