// src/components/agents/TaskCard.tsx
import React from 'react';
import { Clock, CheckCircle, XCircle, Loader2, Pause, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

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
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'executing':
      case 'planning':
      case 'queued':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'waiting_user':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'executing':
        return 'bg-blue-100 text-blue-800';
      case 'planning':
      case 'queued':
        return 'bg-indigo-100 text-indigo-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'waiting_user':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
              {getStatusIcon()}
              <Badge className={getStatusColor()}>
                {status.replace('_', ' ')}
              </Badge>
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
