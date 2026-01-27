import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { AtlasEvent } from '@/hooks/useAtlasLive';

interface ActivityFeedProps {
  events: AtlasEvent[];
  currentTask?: string;
}

export function ActivityFeed({ events, currentTask }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest activity
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getEventIcon = (type: AtlasEvent['type']) => {
    switch (type) {
      case 'task_start':
        return '🚀';
      case 'task_complete':
        return '✅';
      case 'subagent_spawn':
        return '🌱';
      case 'subagent_complete':
        return '🎯';
      case 'thinking':
        return '💭';
      case 'idle':
        return '😴';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  const getEventColor = (type: AtlasEvent['type']) => {
    switch (type) {
      case 'task_start':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'task_complete':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'subagent_spawn':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'subagent_complete':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'thinking':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'idle':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Activity Feed</h3>
        {currentTask && (
          <motion.p
            className="text-sm text-gray-400 mt-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Current: <span className="text-blue-400">{currentTask}</span>
          </motion.p>
        )}
      </div>

      {/* Events list */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={`p-3 rounded-lg border ${getEventColor(event.type)} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-2xl flex-shrink-0">{getEventIcon(event.type)}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {event.taskName || event.subagentLabel || event.type.replace('_', ' ').toUpperCase()}
                    </p>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  
                  {event.message && (
                    <p className="text-xs text-gray-400 mt-1">{event.message}</p>
                  )}

                  {event.subagentLabel && event.type === 'subagent_spawn' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {event.subagentLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">No activity yet... 🌳</p>
          </div>
        )}
      </div>
    </div>
  );
}
