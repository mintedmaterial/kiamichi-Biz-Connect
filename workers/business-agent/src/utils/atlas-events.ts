/**
 * Utility functions for sending events to Atlas Live
 */

export interface AtlasEventData {
  type: 'task_start' | 'task_complete' | 'subagent_spawn' | 'subagent_complete' | 'thinking' | 'idle' | 'error';
  taskName?: string;
  taskId?: string;
  subagentId?: string;
  subagentLabel?: string;
  parentTaskId?: string;
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Send an event to Atlas Live for real-time visualization
 */
export async function sendAtlasEvent(env: Env, eventData: AtlasEventData): Promise<void> {
  if (!env.AtlasLive) {
    console.warn('[Atlas] AtlasLive binding not available');
    return;
  }

  try {
    const atlasLiveId = env.AtlasLive.idFromName("default");
    const atlasLive = env.AtlasLive.get(atlasLiveId);

    const event = {
      id: crypto.randomUUID(),
      ...eventData,
      timestamp: Date.now()
    };

    const response = await atlasLive.fetch(new Request('https://internal/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }));

    if (!response.ok) {
      console.error('[Atlas] Failed to send event:', await response.text());
    }
  } catch (error) {
    console.error('[Atlas] Error sending event:', error);
  }
}

/**
 * Helper to track task lifecycle
 */
export class AtlasTaskTracker {
  private env: Env;
  private taskId: string;
  private taskName: string;

  constructor(env: Env, taskName: string) {
    this.env = env;
    this.taskId = crypto.randomUUID();
    this.taskName = taskName;
  }

  async start(message?: string) {
    await sendAtlasEvent(this.env, {
      type: 'task_start',
      taskId: this.taskId,
      taskName: this.taskName,
      message
    });
  }

  async complete(message?: string) {
    await sendAtlasEvent(this.env, {
      type: 'task_complete',
      taskId: this.taskId,
      taskName: this.taskName,
      message
    });
  }

  async error(message: string) {
    await sendAtlasEvent(this.env, {
      type: 'error',
      taskId: this.taskId,
      taskName: this.taskName,
      message
    });
  }

  async thinking(message?: string) {
    await sendAtlasEvent(this.env, {
      type: 'thinking',
      taskId: this.taskId,
      taskName: this.taskName,
      message
    });
  }

  getTaskId(): string {
    return this.taskId;
  }
}

/**
 * Helper to track subagent lifecycle
 */
export class AtlasSubagentTracker {
  private env: Env;
  private subagentId: string;
  private label: string;
  private parentTaskId?: string;

  constructor(env: Env, label: string, parentTaskId?: string) {
    this.env = env;
    this.subagentId = crypto.randomUUID();
    this.label = label;
    this.parentTaskId = parentTaskId;
  }

  async spawn(taskId: string, message?: string) {
    await sendAtlasEvent(this.env, {
      type: 'subagent_spawn',
      subagentId: this.subagentId,
      subagentLabel: this.label,
      taskId,
      parentTaskId: this.parentTaskId,
      message
    });
  }

  async complete(message?: string) {
    await sendAtlasEvent(this.env, {
      type: 'subagent_complete',
      subagentId: this.subagentId,
      subagentLabel: this.label,
      message
    });
  }

  getSubagentId(): string {
    return this.subagentId;
  }
}
