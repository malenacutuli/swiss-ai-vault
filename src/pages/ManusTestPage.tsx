/**
 * Manus.im API Integration Test Page
 *
 * This page allows testing the Manus.im API integration directly.
 * Navigate to /manus-test to use this page.
 */

import React, { useState } from 'react';
import { useManusExecution } from '@/hooks/useManusExecution';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Square, ExternalLink, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ManusTestPage() {
  const [prompt, setPrompt] = useState('Say hello and briefly describe what you can do as an AI agent.');

  const {
    task,
    status,
    error,
    messages,
    terminalLines,
    isExecuting,
    isCompleted,
    isFailed,
    executeTask,
    cancelTask,
    reset,
  } = useManusExecution({
    onComplete: (task) => {
      console.log('Task completed:', task);
    },
    onError: (err) => {
      console.error('Task error:', err);
    },
  });

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    try {
      await executeTask({
        prompt: prompt.trim(),
        task_type: 'general',
      });
    } catch (err) {
      console.error('Execute error:', err);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'executing':
      case 'planning':
        return <Badge className="bg-blue-500/20 text-blue-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Executing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Manus.im API Test</h1>
          <p className="text-gray-400">Test the Manus.im API integration</p>
        </div>

        {/* Input Card */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Create Task</CardTitle>
            <CardDescription>Enter a prompt to send to Manus.im</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              className="min-h-[100px] bg-gray-800 border-gray-700"
              disabled={isExecuting}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={isExecuting || !prompt.trim()}
                className="flex-1"
              >
                {isExecuting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executing...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Execute via Manus.im</>
                )}
              </Button>
              {isExecuting && (
                <Button variant="destructive" onClick={cancelTask}>
                  <Square className="w-4 h-4 mr-2" />Cancel
                </Button>
              )}
              {(isCompleted || isFailed) && (
                <Button variant="outline" onClick={reset}>
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        {task && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Task Status</CardTitle>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Run ID:</span>
                  <span className="ml-2 font-mono">{task.id}</span>
                </div>
                {task.manus_task_id && (
                  <div>
                    <span className="text-gray-400">Manus Task ID:</span>
                    <span className="ml-2 font-mono">{task.manus_task_id}</span>
                  </div>
                )}
                {task.credits_used !== undefined && (
                  <div>
                    <span className="text-gray-400">Credits Used:</span>
                    <span className="ml-2">{task.credits_used}</span>
                  </div>
                )}
              </div>

              {task.manus_task_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={task.manus_task_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Manus.im
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Terminal Output */}
        {terminalLines.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Terminal Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] bg-black rounded-lg p-4 font-mono text-sm">
                {terminalLines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      'whitespace-pre-wrap',
                      line.type === 'stderr' && 'text-red-400',
                      line.type === 'system' && 'text-yellow-400',
                      line.type === 'stdout' && 'text-gray-200'
                    )}
                  >
                    {line.content}
                  </div>
                ))}
                <div className="text-green-400 animate-pulse">█</div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'p-4 rounded-lg',
                      msg.role === 'user' ? 'bg-blue-500/10 ml-8' : 'bg-gray-800 mr-8'
                    )}
                  >
                    <div className="text-xs text-gray-400 mb-1">{msg.role}</div>
                    <div className="text-gray-200 whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="bg-red-900/20 border-red-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
