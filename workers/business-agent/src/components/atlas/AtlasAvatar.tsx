import { motion } from 'framer-motion';

interface AtlasAvatarProps {
  state: 'idle' | 'thinking' | 'coding' | 'deploying' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

export function AtlasAvatar({ state, size = 'md' }: AtlasAvatarProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-2xl',
    md: 'w-20 h-20 text-5xl',
    lg: 'w-32 h-32 text-8xl'
  };

  const stateColors = {
    idle: 'from-green-500 to-emerald-600',
    thinking: 'from-blue-500 to-cyan-600',
    coding: 'from-purple-500 to-pink-600',
    deploying: 'from-orange-500 to-yellow-600',
    error: 'from-red-500 to-rose-600'
  };

  const stateGlow = {
    idle: 'shadow-green-500/50',
    thinking: 'shadow-blue-500/50',
    coding: 'shadow-purple-500/50',
    deploying: 'shadow-orange-500/50',
    error: 'shadow-red-500/50'
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Glow effect */}
      <motion.div
        className={`absolute rounded-full bg-gradient-to-br ${stateColors[state]} ${sizeClasses[size]} blur-xl opacity-50`}
        animate={{
          scale: state === 'idle' ? [1, 1.1, 1] : [1, 1.3, 1],
          opacity: state === 'idle' ? [0.3, 0.5, 0.3] : [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: state === 'idle' ? 3 : 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Avatar container */}
      <motion.div
        className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br ${stateColors[state]} shadow-2xl ${stateGlow[state]} flex items-center justify-center`}
        animate={{
          scale: state === 'idle' ? [1, 1.02, 1] : [1, 1.05, 1],
          rotate: state === 'coding' ? [0, 5, -5, 0] : 0
        }}
        transition={{
          scale: {
            duration: state === 'idle' ? 4 : 2,
            repeat: Infinity,
            ease: 'easeInOut'
          },
          rotate: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }}
      >
        {/* Tree emoji */}
        <motion.span
          className="relative z-10"
          animate={{
            y: state === 'thinking' ? [-2, 2, -2] : 0
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          🌳
        </motion.span>

        {/* Pulse ring for active states */}
        {state !== 'idle' && state !== 'error' && (
          <motion.div
            className={`absolute inset-0 rounded-full border-2 border-white`}
            animate={{
              scale: [1, 1.5],
              opacity: [0.5, 0]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut'
            }}
          />
        )}

        {/* Error shake */}
        {state === 'error' && (
          <motion.div
            className="absolute inset-0"
            animate={{
              x: [-2, 2, -2, 2, 0]
            }}
            transition={{
              duration: 0.5,
              repeat: 3
            }}
          />
        )}
      </motion.div>

      {/* State indicator dots */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
        {state === 'coding' && (
          <>
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </>
        )}
      </div>
    </div>
  );
}
