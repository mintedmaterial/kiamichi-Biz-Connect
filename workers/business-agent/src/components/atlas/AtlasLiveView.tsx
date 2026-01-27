import { motion, AnimatePresence } from 'framer-motion';
import { useAtlasLive } from '@/hooks/useAtlasLive';
import { AtlasAvatar } from './AtlasAvatar';
import { ActivityFeed } from './ActivityFeed';
import { SubagentTree } from './SubagentTree';
import { Button } from '@/components/button/Button';

interface AtlasLiveViewProps {
  className?: string;
  compact?: boolean;
}

export function AtlasLiveView({ className = '', compact = false }: AtlasLiveViewProps) {
  const { state, isConnected, error, reconnect } = useAtlasLive();

  const getStateText = (currentState: typeof state.currentState) => {
    switch (currentState) {
      case 'idle':
        return 'Resting in the forest...';
      case 'thinking':
        return 'Deep in thought...';
      case 'coding':
        return 'Growing new branches...';
      case 'deploying':
        return 'Planting seeds...';
      case 'error':
        return 'Weathering the storm...';
      default:
        return 'Standing tall...';
    }
  };

  if (compact) {
    return (
      <div className={`bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 ${className}`}>
        <div className="flex items-center gap-4">
          <AtlasAvatar state={state.currentState} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{getStateText(state.currentState)}</p>
            {state.currentTask && (
              <p className="text-xs text-gray-400 truncate">{state.currentTask}</p>
            )}
          </div>
          {state.activeSubagents.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {state.activeSubagents.length} 🌱
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900/95 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <AtlasAvatar state={state.currentState} size="md" />
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Atlas Live View
                {isConnected ? (
                  <motion.span
                    className="w-2 h-2 rounded-full bg-green-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                )}
              </h2>
              <p className="text-gray-400 mt-1">{getStateText(state.currentState)}</p>
              {state.currentTask && (
                <p className="text-sm text-blue-400 mt-1">Working on: {state.currentTask}</p>
              )}
            </div>
          </div>

          {/* Connection status */}
          <div className="flex flex-col items-end gap-2">
            {!isConnected && (
              <Button
                onClick={reconnect}
                variant="outline"
                className="text-xs"
              >
                Reconnect
              </Button>
            )}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Left: Activity Feed */}
        <div className="lg:col-span-2 bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
          <ActivityFeed events={state.recentEvents} currentTask={state.currentTask} />
        </div>

        {/* Right: Subagents */}
        <div className="space-y-4">
          <AnimatePresence>
            {state.activeSubagents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <SubagentTree subagents={state.activeSubagents} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          <motion.div
            className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h4 className="text-sm font-semibold text-white mb-3">Statistics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Events:</span>
                <span className="text-white font-medium">{state.recentEvents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Subagents:</span>
                <span className="text-white font-medium">{state.activeSubagents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current State:</span>
                <span className="text-white font-medium capitalize">{state.currentState}</span>
              </div>
            </div>
          </motion.div>

          {/* Legend */}
          <motion.div
            className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h4 className="text-sm font-semibold text-white mb-3">Legend</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span>🚀</span>
                <span className="text-gray-400">Task Started</span>
              </div>
              <div className="flex items-center gap-2">
                <span>✅</span>
                <span className="text-gray-400">Task Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🌱</span>
                <span className="text-gray-400">Subagent Spawned</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <span className="text-gray-400">Subagent Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <span>💭</span>
                <span className="text-gray-400">Thinking</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
