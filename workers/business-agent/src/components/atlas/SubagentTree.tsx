import { motion } from 'framer-motion';

interface Subagent {
  id: string;
  label: string;
  taskId: string;
}

interface SubagentTreeProps {
  subagents: Subagent[];
}

export function SubagentTree({ subagents }: SubagentTreeProps) {
  if (subagents.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌲</span>
        <h4 className="text-sm font-semibold text-white">Active Subagents</h4>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {subagents.length}
        </span>
      </div>

      <div className="space-y-3">
        {subagents.map((subagent, index) => (
          <motion.div
            key={subagent.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            className="relative pl-6"
          >
            {/* Branch line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 to-transparent" />
            <div className="absolute left-0 top-3 w-4 h-px bg-purple-500/50" />

            {/* Subagent card */}
            <motion.div
              className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 backdrop-blur-sm"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(168, 85, 247, 0)',
                  '0 0 20px 2px rgba(168, 85, 247, 0.3)',
                  '0 0 0 0 rgba(168, 85, 247, 0)'
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <div className="flex items-center gap-2">
                {/* Pulsing indicator */}
                <motion.div
                  className="w-2 h-2 rounded-full bg-purple-400"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />

                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{subagent.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Task: {subagent.taskId}</p>
                </div>

                {/* Sprouting animation */}
                <motion.span
                  className="text-lg"
                  animate={{
                    rotate: [-5, 5, -5],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  🌱
                </motion.span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Root visualization */}
      <motion.div
        className="mt-4 pt-4 border-t border-gray-700/50 flex items-center gap-2 text-xs text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span>🌳</span>
        <span>Atlas (Main)</span>
      </motion.div>
    </div>
  );
}
