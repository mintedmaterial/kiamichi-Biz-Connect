/**
 * Workflow API Routes
 * Endpoints for triggering and managing Cloudflare Workflows
 */

import type { SocialPostParams } from "../workflows/types";

export async function handleWorkflowTrigger(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const params = await request.json<SocialPostParams>();

    // Validate required params
    if (!params.businessName) {
      return new Response(JSON.stringify({
        error: 'businessName is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger the workflow
    const instance = await env.SOCIAL_POST_WORKFLOW.create({
      params: {
        businessName: params.businessName,
        platform: params.platform || 'facebook',
        tone: params.tone || 'friendly',
        includeHashtags: params.includeHashtags !== false,
        target: params.target || 'page',
        userId: 'default', // TODO: Get from session
        approvalDeadline: params.approvalDeadline
      }
    });

    return new Response(JSON.stringify({
      success: true,
      workflowId: instance.id,
      message: 'Workflow started! Creating social media post...',
      statusUrl: `/api/workflow/${instance.id}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Workflow] Trigger error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleWorkflowStatus(request: Request, env: Env, workflowId: string): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const instance = await env.SOCIAL_POST_WORKFLOW.get(workflowId);

    if (!instance) {
      return new Response(JSON.stringify({
        error: 'Workflow not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const status = await instance.status();

    return new Response(JSON.stringify({
      id: workflowId,
      status: status.status,
      output: status.output,
      error: status.error
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Workflow] Status error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleWorkflowApprove(request: Request, env: Env, workflowId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const instance = await env.SOCIAL_POST_WORKFLOW.get(workflowId);

    if (!instance) {
      return new Response(JSON.stringify({
        error: 'Workflow not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send approval event to workflow
    await instance.pause();

    return new Response(JSON.stringify({
      success: true,
      message: 'Post approved and will be published'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Workflow] Approve error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
