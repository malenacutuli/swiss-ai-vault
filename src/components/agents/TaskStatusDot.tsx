import React from 'react';
import { cn } from '@/lib/utils';

export type TaskStatus =
  | 'pending'
  | 'created'
  | 'queued'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'waiting_user';

interface TaskStatusDotProps {
  status: TaskStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<string, {
  color: string;
  bgColor: string;
  ringColor: string;
  label: string;
  pulse: boolean;
}> = {
  pending: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-100',
    ringColor: 'ring-gray-200',
    label: 'Pending',
    pulse: false,
  },
  created: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-100',
    ringColor: 'ring-gray-200',
    label: 'Created',
    pulse: false,
  },
  queued: {
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-100',
    ringColor: 'ring-indigo-200',
    label: 'Queued',
    pulse: true,
  },
  planning: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    ringColor: 'ring-blue-200',
    label: 'Planning',
    pulse: true,
  },
  executing: {
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    ringColor: 'ring-emerald-200',
    label: 'Executing',
    pulse: true,
  },
  completed: {
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    ringColor: 'ring-green-200',
    label: 'Completed',
    pulse: false,
  },
  failed: {
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    ringColor: 'ring-red-200',
    label: 'Failed',
    pulse: false,
  },
  cancelled: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-100',
    ringColor: 'ring-gray-200',
    label: 'Cancelled',
    pulse: false,
  },
  paused: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    ringColor: 'ring-yellow-200',
    label: 'Paused',
    pulse: false,
  },
  waiting_user: {
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    ringColor: 'ring-purple-200',
    label: 'Waiting for Input',
    pulse: true,
  },
};

const sizeClasses = {
  sm: {
    dot: 'w-2 h-2',
    ring: 'w-4 h-4',
    text: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    dot: 'w-2.5 h-2.5',
    ring: 'w-5 h-5',
    text: 'text-sm',
    gap: 'gap-2',
  },
  lg: {
    dot: 'w-3 h-3',
    ring: 'w-6 h-6',
    text: 'text-base',
    gap: 'gap-2.5',
  },
};

export const TaskStatusDot: React.FC<TaskStatusDotProps> = ({
  status,
  size = 'md',
  showLabel = false,
  className,
}) => {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeConfig = sizeClasses[size];

  return (
    <div className={cn('flex items-center', sizeConfig.gap, className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer ring for pulsing statuses */}
        {config.pulse && (
          <span
            className={cn(
              'absolute rounded-full animate-ping opacity-75',
              config.color,
              sizeConfig.ring
            )}
            style={{ animationDuration: '1.5s' }}
          />
        )}
        {/* Main dot */}
        <span
          className={cn(
            'relative rounded-full ring-2',
            config.color,
            config.ringColor,
            sizeConfig.dot
          )}
        />
      </div>
      {showLabel && (
        <span className={cn('font-medium text-gray-700', sizeConfig.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
};

// Badge variant with background
export const TaskStatusBadge: React.FC<TaskStatusDotProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeConfig = sizeClasses[size];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1',
        sizeConfig.gap,
        config.bgColor,
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {config.pulse && (
          <span
            className={cn(
              'absolute rounded-full animate-ping opacity-75',
              config.color,
              'w-2 h-2'
            )}
            style={{ animationDuration: '1.5s' }}
          />
        )}
        <span className={cn('relative rounded-full', config.color, 'w-2 h-2')} />
      </div>
      <span className={cn('font-medium', sizeConfig.text)} style={{ color: 'inherit' }}>
        {config.label}
      </span>
    </div>
  );
};

export default TaskStatusDot;
