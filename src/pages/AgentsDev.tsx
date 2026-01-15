/**
 * AgentsDev - Development test page for Claude Code agent implementations
 * 
 * This page connects to the direct Supabase project (ghmmdochvlrnwbruyrqk)
 * allowing isolated testing of agent functionality without affecting production.
 * 
 * Access at: /agents-dev
 */
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { AlertTriangle, Server, Zap, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentExecutionDev } from '@/hooks/useAgentExecutionDev';
import { isAgentsClientConfigured, getAgentsProjectUrl } from '@/integrations/supabase/agents-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function AgentsDev() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const isConfigured = isAgentsClientConfigured();
  const backendUrl = getAgentsProjectUrl();
  
  const execution = useAgentExecutionDev({
    onComplete: (task) => toast.success(`Task completed: ${task.id}`),
    onError: (err) => toast.error(err),
  });

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!user) {
      toast.error('Please sign in to test agents');
      return;
    }

    await execution.createTask(prompt, {
      taskType: 'general',
    });
  };

  return (
    <>
      <Helmet>
        <title>Agents Dev | SwissBrain.ai</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Dev Mode Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                DEV MODE - Claude Code Agents Testing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConfigured ? 'default' : 'destructive'} className="text-xs">
                <Server className="w-3 h-3 mr-1" />
                {isConfigured ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-bold tracking-tight">
              Agents Development Environment
            </h1>
            <p className="text-muted-foreground">
              Test Claude Code agent implementations against the direct Supabase project.
            </p>
          </motion.div>

          {/* Backend Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Backend Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Project URL:</span>
                  <p className="font-mono text-xs mt-1 truncate">{backendUrl}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className={cn(
                    "mt-1 font-medium",
                    isConfigured ? "text-green-600" : "text-red-600"
                  )}>
                    {isConfigured ? 'Ready' : 'Missing Configuration'}
                  </p>
                </div>
              </div>
              
              {!isConfigured && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Configuration Required</AlertTitle>
                  <AlertDescription>
                    Set <code className="bg-muted px-1 rounded">VITE_AGENTS_SUPABASE_URL</code> and{' '}
                    <code className="bg-muted px-1 rounded">VITE_AGENTS_SUPABASE_KEY</code> environment variables.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Task Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Test Task Execution</CardTitle>
              <CardDescription>
                Submit a task to test the agent execution pipeline on the dev backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter your test prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={!isConfigured || execution.isExecuting}
              />
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {execution.backendInfo}
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!isConfigured || !prompt.trim() || execution.isExecuting}
                  className="gap-2"
                >
                  {execution.isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Execute Task
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Execution Status */}
          {execution.showExecutionView && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Execution Status</span>
                  <Badge variant={
                    execution.isCompleted ? 'default' :
                    execution.isFailed ? 'destructive' :
                    'secondary'
                  }>
                    {execution.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Task Info */}
                {execution.task && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Task ID:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{execution.task.id}</code>
                    </div>
                    {execution.task.progress_percentage !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Progress:</span>
                        <span>{execution.task.progress_percentage}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Steps */}
                {execution.steps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Steps ({execution.steps.length})
                    </h4>
                    <div className="space-y-1">
                      {execution.steps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                        >
                          <span className="truncate">{step.description || step.step_type}</span>
                          <Badge variant="outline" className="text-xs">
                            {step.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outputs */}
                {execution.outputs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Outputs ({execution.outputs.length})
                    </h4>
                    <div className="space-y-1">
                      {execution.outputs.map((output) => (
                        <div
                          key={output.id}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                        >
                          <span className="truncate">{output.file_name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => execution.downloadOutput(output)}
                          >
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {execution.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{execution.error}</AlertDescription>
                  </Alert>
                )}

                {/* Result */}
                {execution.task?.result_summary && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Result
                    </h4>
                    <p className="text-sm bg-muted/50 p-3 rounded">
                      {execution.task.result_summary}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={execution.reset}
                  >
                    Reset
                  </Button>
                  {execution.isFailed && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={execution.retryTask}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/ghost/agents" className="hover:text-foreground underline">
              → Production Agents
            </a>
            <a href="/agents" className="hover:text-foreground underline">
              → Agents (Main)
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
