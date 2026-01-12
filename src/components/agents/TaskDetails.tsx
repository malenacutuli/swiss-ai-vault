// src/components/agents/TaskDetails.tsx
import React, { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, Loader2, Clock, FileText,
  Download, ExternalLink, Play, Pause, XOctagon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface TaskDetailsProps {
  taskId: string;
  onClose: () => void;
}

interface TaskStep {
  id: string;
  task_id: string;
  step_number: number;
  step_type: string;
  tool_name: string | null;
  description: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface TaskOutput {
  id: string;
  task_id: string;
  step_id: string | null;
  artifact_id: string | null;
  output_type: string | null;
  content: any;
  created_at: string;
}

export function TaskDetails({ taskId, onClose }: TaskDetailsProps) {
  const [task, setTask] = useState<any>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);

      const [taskRes, stepsRes, outputsRes] = await Promise.all([
        supabase.from('agent_tasks').select('*').eq('id', taskId).single(),
        supabase.from('agent_task_steps').select('*').eq('task_id', taskId).order('step_number'),
        supabase.from('agent_task_outputs').select('*').eq('task_id', taskId).order('created_at')
      ]);

      setTask(taskRes.data);
      setSteps(stepsRes.data || []);
      setOutputs(outputsRes.data || []);
      setIsLoading(false);
    };

    fetchDetails();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`task_${taskId}_updates`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_task_steps', filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSteps(prev => [...prev, payload.new as TaskStep]);
          } else if (payload.eventType === 'UPDATE') {
            setSteps(prev => prev.map(s => s.id === payload.new.id ? payload.new as TaskStep : s));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agent_tasks', filter: `id=eq.${taskId}` },
        (payload) => {
          setTask(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_task_outputs', filter: `task_id=eq.${taskId}` },
        (payload) => {
          setOutputs(prev => [...prev, payload.new as TaskOutput]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const handleAction = async (action: string) => {
    await supabase.functions.invoke('agent-execute', {
      body: { action, run_id: taskId }
    });
  };

  const getStepIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#1D4E5F]" />
        </CardContent>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          Task not found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{task.prompt.slice(0, 100)}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex gap-2">
            {task.status === 'paused' && (
              <Button size="sm" onClick={() => handleAction('continue')} className="bg-[#1D4E5F] hover:bg-[#163d4d]">
                <Play className="w-4 h-4 mr-1" /> Resume
              </Button>
            )}
            {['executing', 'planning', 'queued'].includes(task.status) && (
              <Button size="sm" variant="outline" onClick={() => handleAction('cancel')}>
                <XOctagon className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge className={
              task.status === 'completed' ? 'bg-green-100 text-green-800' :
              task.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }>
              {task.status.replace('_', ' ')}
            </Badge>
            {task.credits_used > 0 && (
              <span className="text-sm text-gray-500">
                Credits: {task.credits_used}
              </span>
            )}
            {task.duration_ms && (
              <span className="text-sm text-gray-500">
                Duration: {(task.duration_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {task.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {task.error_message}
            </div>
          )}
          {task.plan_summary && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-sm">
              <strong>Plan:</strong> {task.plan_summary}
            </div>
          )}
          {task.result_summary && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-900 text-sm">
              <strong>Result:</strong> {task.result_summary}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  {getStepIcon(step.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        Step {step.step_number}: {step.step_type}
                      </p>
                      {step.tool_name && (
                        <Badge variant="outline" className="text-xs">
                          {step.tool_name}
                        </Badge>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    )}
                    {step.started_at && step.completed_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Took {((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outputs/Artifacts */}
      {outputs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outputs & Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {outputs.map((output) => (
                <div key={output.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <FileText className="w-5 h-5 text-[#1D4E5F]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {output.output_type || 'Output'}
                    </p>
                    {output.artifact_id && (
                      <p className="text-xs text-gray-500 truncate">
                        ID: {output.artifact_id.slice(0, 16)}...
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(output.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {output.artifact_id && (
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
