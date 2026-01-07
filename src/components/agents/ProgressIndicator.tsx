import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  progress: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressIndicator({
  progress,
  status,
  size = 'md',
}: ProgressIndicatorProps) {
  const sizes = {
    sm: { ring: 40, stroke: 3, text: 'text-xs' },
    md: { ring: 80, stroke: 4, text: 'text-lg' },
    lg: { ring: 120, stroke: 6, text: 'text-2xl' },
  };

  const colors = {
    pending: '#9CA3AF',
    executing: '#1D4E5F',
    completed: '#22C55E',
    failed: '#EF4444',
  };

  const { ring, stroke, text } = sizes[size];
  const radius = (ring - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Pulse animation for executing status */}
      {status === 'executing' && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: ring + 8,
            height: ring + 8,
            backgroundColor: colors.executing,
            opacity: 0.2,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.1, 0.2],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <svg width={ring} height={ring} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <motion.circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke={colors[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>

      {/* Percentage text */}
      <span className={`absolute ${text} font-semibold text-foreground`}>
        {progress}%
      </span>
    </div>
  );
}
