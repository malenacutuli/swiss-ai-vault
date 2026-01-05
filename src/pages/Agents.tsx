import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Search, FileText, Presentation, Table, BarChart, Calendar, Plus, Loader2 } from 'lucide-react';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import {
  AgentTaskCard,
  QuickActionButton,
  PrivacyTierSelector,
  ConnectedServicesRow,
  EmptyTaskState,
  type PrivacyTier,
} from '@/components/agents';
import type { AgentTask } from '@/hooks/useAgentTasks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const quickActions = [
  { id: 'research', label: 'Research', icon: Search },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: Table },
  { id: 'analysis', label: 'Analysis', icon: BarChart },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
];

export default function Agents() {
  const { activeTasks, recentTasks, activeCount, isLoading } = useAgentTasks();
  const [prompt, setPrompt] = useState('');
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('vault');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickAction = (actionId: string) => {
    setSelectedAction(selectedAction === actionId ? null : actionId);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe your task');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Call agent-execute edge function
      toast.info('Agent execution coming soon');
    } catch (error) {
      console.error('Failed to start task:', error);
      toast.error('Failed to start task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewTask = (task: AgentTask) => {
    // TODO: Open task detail modal/page
    toast.info(`Viewing task: ${task.id}`);
  };

  const handleDownloadTask = (task: AgentTask) => {
    // TODO: Download task outputs
    toast.info('Download coming soon');
  };

  return (
    <>
      <Helmet>
        <title>Swiss Agents | SwissVault.ai</title>
        <meta name="description" content="Autonomous AI agents that work for you. Create research, documents, presentations, and more." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                Swiss Agents
                <Sparkles className="h-5 w-5 text-primary/60" />
              </h1>
              <p className="text-muted-foreground mt-1">Autonomous AI that works for you</p>
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          </header>

          {/* Hero Input Section */}
          <section className="mb-16">
            <h2 className="text-3xl font-light text-center text-foreground mb-6">
              What can I do for you?
            </h2>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <Textarea
                placeholder="Describe your task..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={cn(
                  'min-h-[120px] resize-none text-base',
                  'bg-card border-border focus:border-primary/50'
                )}
              />

              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.map((action) => (
                  <QuickActionButton
                    key={action.id}
                    icon={action.icon}
                    label={action.label}
                    isActive={selectedAction === action.id}
                    onClick={() => handleQuickAction(action.id)}
                  />
                ))}
              </div>

              {/* Connected Services & Privacy Tier */}
              <div className="flex items-center justify-between pt-2">
                <ConnectedServicesRow />
                <PrivacyTierSelector value={privacyTier} onChange={setPrivacyTier} />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !prompt.trim()}
                  className="bg-primary hover:bg-primary/90 px-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Task'
                  )}
                </Button>
              </div>
            </div>
          </section>

          {/* Active Tasks */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-medium text-foreground">Active Tasks</h3>
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeCount}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeTasks.length === 0 ? (
              <EmptyTaskState variant="active" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeTasks.map((task) => (
                  <AgentTaskCard
                    key={task.id}
                    task={task}
                    variant="active"
                    onView={handleViewTask}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Tasks */}
          <section>
            <h3 className="text-lg font-medium text-foreground mb-4">Recent Tasks</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentTasks.length === 0 ? (
              <EmptyTaskState variant="recent" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentTasks.map((task) => (
                  <AgentTaskCard
                    key={task.id}
                    task={task}
                    variant="recent"
                    onView={handleViewTask}
                    onDownload={handleDownloadTask}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
