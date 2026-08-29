import { BusinessDiscoveryWorkflow, VerificationWorkflow } from './workflows';
import { BusinessCandidate, Env } from './types';

export { BusinessDiscoveryWorkflow, VerificationWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'healthy' });
    if (url.pathname === '/run' && request.method === 'POST') {
      if (!env.ADMIN_KEY || request.headers.get('X-Admin-Key') !== env.ADMIN_KEY) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (env.DISCOVERY_ENABLED !== 'true') {
        return Response.json({ error: 'Discovery is disabled' }, { status: 409 });
      }
      const runDate = new Date().toISOString().slice(0, 10);
      const instance = await env.DISCOVERY_WORKFLOW.create({ id: `discovery-${runDate}`, params: { runDate } });
      return Response.json({ instanceId: instance.id, runDate }, { status: 202 });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (env.DISCOVERY_ENABLED !== 'true') {
      console.log('Business discovery cron skipped because DISCOVERY_ENABLED is false');
      return;
    }
    const runDate = new Date(event.scheduledTime).toISOString().slice(0, 10);
    await env.DISCOVERY_WORKFLOW.create({ id: `discovery-${runDate}`, params: { runDate } });
  },

  async queue(batch: MessageBatch<BusinessCandidate>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const candidate = message.body;
        const safeSourceId = candidate.sourceId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
        const runDate = new Date().toISOString().slice(0, 10);
        await env.VERIFICATION_WORKFLOW.create({
          id: `verify-${runDate}-${candidate.source}-${safeSourceId}`,
          params: { candidate },
        });
        message.ack();
      } catch (error) {
        console.error('Failed to create verification workflow', error);
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
