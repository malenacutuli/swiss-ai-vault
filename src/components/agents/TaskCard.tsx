// src/components/agents/TaskCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { TaskStatusDot, TaskStatusBadge } from './TaskStatusDot';

interface TaskCardProps {
  id: string;
  prompt: string;
  status: string;
  plan_summary: string | null;
  current_step: number | null;
  total_steps: number | null;
  progress_percentage: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  onClick: (id: string) => void;
  isSelected?: boolean;
}

export function TaskCard({
  id,
  prompt,
  status,
  plan_summary,
  current_step,
  total_steps,
  progress_percentage,
  created_at,
  started_at,
  completed_at,
  error_message,
  onClick,
  isSelected
}: TaskCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-[#1D4E5F] border-2 shadow-md' : ''
      }`}
      onClick={() => onClick(id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {prompt.slice(0, 80)}{prompt.length > 80 ? '...' : ''}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <TaskStatusBadge status={status} size="sm" />
              {total_steps && total_steps > 0 && (
                <span className="text-xs text-gray-500">
                  {current_step || 0}/{total_steps} steps
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            {created_at && formatDistanceToNow(new Date(created_at), { addSuffix: true })}
          </div>
        </div>

        {error_message && (
          <p className="mt-2 text-sm text-red-600 truncate">
            Error: {error_message}
          </p>
        )}

        {status === 'executing' && progress_percentage !== null && progress_percentage > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-[#1D4E5F] h-1.5 rounded-full transition-all"
                style={{ width: `${progress_percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {progress_percentage}% complete
            </p>
          </div>
        )}

        {plan_summary && (
          <p className="mt-2 text-xs text-gray-500 truncate">
            {plan_summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
