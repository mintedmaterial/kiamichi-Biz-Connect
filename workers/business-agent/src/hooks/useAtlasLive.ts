import { useEffect, useState, useRef, useCallback } from 'react';

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

export interface AtlasState {
  currentState: 'idle' | 'thinking' | 'coding' | 'deploying' | 'error';
  currentTask?: string;
  activeSubagents: Array<{ id: string; label: string; taskId: string }>;
  recentEvents: AtlasEvent[];
}

export interface UseAtlasLiveReturn {
  state: AtlasState;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useAtlasLive(): UseAtlasLiveReturn {
  const [state, setState] = useState<AtlasState>({
    currentState: 'idle',
    activeSubagents: [],
    recentEvents: []
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Get the Atlas Live Durable Object WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/atlas/live/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Atlas] WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);

        ws.addEventListener('close', () => {
          clearInterval(pingInterval);
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'state') {
            // Initial state from server
            setState(data.data);
          } else if (data.type === 'event') {
            // New event
            const newEvent = data.data as AtlasEvent;
            setState(prev => {
              const newState = { ...prev };
              
              // Update based on event type
              switch (newEvent.type) {
                case 'task_start':
                  newState.currentState = 'thinking';
                  newState.currentTask = newEvent.taskName;
                  break;
                case 'task_complete':
                  newState.currentState = 'idle';
                  newState.currentTask = undefined;
                  break;
                case 'subagent_spawn':
                  if (newEvent.subagentId && newEvent.subagentLabel && newEvent.taskId) {
                    newState.activeSubagents = [
                      ...newState.activeSubagents,
                      {
                        id: newEvent.subagentId,
                        label: newEvent.subagentLabel,
                        taskId: newEvent.taskId
                      }
                    ];
                  }
                  newState.currentState = 'coding';
                  break;
                case 'subagent_complete':
                  if (newEvent.subagentId) {
                    newState.activeSubagents = newState.activeSubagents.filter(
                      s => s.id !== newEvent.subagentId
                    );
                  }
                  if (newState.activeSubagents.length === 0) {
                    newState.currentState = 'idle';
                  }
                  break;
                case 'thinking':
                  newState.currentState = 'thinking';
                  break;
                case 'error':
                  newState.currentState = 'error';
                  break;
                case 'idle':
                  newState.currentState = 'idle';
                  break;
              }

              // Add to recent events (keep last 20)
              newState.recentEvents = [...prev.recentEvents, newEvent].slice(-20);

              return newState;
            });
          }
        } catch (err) {
          console.error('[Atlas] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[Atlas] WebSocket error:', event);
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('[Atlas] WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff
        if (reconnectAttemptsRef.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          console.log(`[Atlas] Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Failed to reconnect after multiple attempts');
        }
      };
    } catch (err) {
      console.error('[Atlas] Failed to create WebSocket:', err);
      setError('Failed to connect');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    state,
    isConnected,
    error,
    reconnect
  };
}
