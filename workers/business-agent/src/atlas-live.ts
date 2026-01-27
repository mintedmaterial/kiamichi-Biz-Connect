import { DurableObject } from "cloudflare:workers";

export interface AtlasEvent {
  id: string;
  type: 'task_start' | 'task_complete' | 'subagent_spawn' | 'subagent_complete' | 'thinking' | 'idle' | 'error';
  taskName?: string;
  taskId?: string;
  subagentId?: string;
  subagentLabel?: string;
  parentTaskId?: string;
  message?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface AtlasState {
  currentState: 'idle' | 'thinking' | 'coding' | 'deploying' | 'error';
  currentTask?: string;
  activeSubagents: Map<string, { label: string; taskId: string }>;
  recentEvents: AtlasEvent[];
}

export class AtlasLive extends DurableObject<Env> {
  private sessions: Set<WebSocket>;
  private state: AtlasState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Set();
    this.state = {
      currentState: 'idle',
      activeSubagents: new Map(),
      recentEvents: []
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.sessions.add(server);

      // Send current state to new client
      server.send(JSON.stringify({
        type: 'state',
        data: {
          currentState: this.state.currentState,
          currentTask: this.state.currentTask,
          activeSubagents: Array.from(this.state.activeSubagents.entries()).map(([id, data]) => ({
            id,
            ...data
          })),
          recentEvents: this.state.recentEvents.slice(-20)
        }
      }));

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // Event ingestion endpoint
    if (url.pathname === '/event' && request.method === 'POST') {
      try {
        const event = await request.json() as AtlasEvent;
        await this.handleEvent(event);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid event' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Get current status
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        currentState: this.state.currentState,
        currentTask: this.state.currentTask,
        activeSubagents: Array.from(this.state.activeSubagents.entries()).map(([id, data]) => ({
          id,
          ...data
        })),
        recentEvents: this.state.recentEvents.slice(-20)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get activity history
    if (url.pathname === '/activity') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const results = await this.env.DB.prepare(
          'SELECT * FROM atlas_activity ORDER BY created_at DESC LIMIT ?'
        ).bind(limit).all();

        return new Response(JSON.stringify(results.results), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleEvent(event: AtlasEvent) {
    // Update state based on event type
    switch (event.type) {
      case 'task_start':
        this.state.currentState = 'thinking';
        this.state.currentTask = event.taskName;
        break;
      case 'task_complete':
        this.state.currentState = 'idle';
        this.state.currentTask = undefined;
        break;
      case 'subagent_spawn':
        if (event.subagentId && event.subagentLabel && event.taskId) {
          this.state.activeSubagents.set(event.subagentId, {
            label: event.subagentLabel,
            taskId: event.taskId
          });
        }
        this.state.currentState = 'coding';
        break;
      case 'subagent_complete':
        if (event.subagentId) {
          this.state.activeSubagents.delete(event.subagentId);
        }
        if (this.state.activeSubagents.size === 0) {
          this.state.currentState = 'idle';
        }
        break;
      case 'thinking':
        this.state.currentState = 'thinking';
        break;
      case 'error':
        this.state.currentState = 'error';
        break;
      case 'idle':
        this.state.currentState = 'idle';
        break;
    }

    // Add to recent events
    this.state.recentEvents.push(event);
    if (this.state.recentEvents.length > 50) {
      this.state.recentEvents.shift();
    }

    // Store in database
    try {
      await this.env.DB.prepare(`
        INSERT INTO atlas_activity (event_type, task_name, task_id, subagent_id, subagent_label, parent_task_id, message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.type,
        event.taskName || null,
        event.taskId || null,
        event.subagentId || null,
        event.subagentLabel || null,
        event.parentTaskId || null,
        event.message || null,
        event.metadata ? JSON.stringify(event.metadata) : null
      ).run();

      // Clean up old events (keep last 1000)
      await this.env.DB.prepare(`
        DELETE FROM atlas_activity 
        WHERE id NOT IN (
          SELECT id FROM atlas_activity ORDER BY created_at DESC LIMIT 1000
        )
      `).run();
    } catch (error) {
      console.error('Failed to store atlas event:', error);
    }

    // Broadcast to all connected clients
    this.broadcast({
      type: 'event',
      data: event
    });
  }

  broadcast(message: any) {
    const msg = JSON.stringify(message);
    this.sessions.forEach(session => {
      try {
        session.send(msg);
      } catch (error) {
        console.error('Failed to send to session:', error);
        this.sessions.delete(session);
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Handle ping/pong for keep-alive
    if (message === 'ping') {
      ws.send('pong');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    this.sessions.delete(ws);
  }
}
