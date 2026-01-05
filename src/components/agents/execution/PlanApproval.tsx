import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';

interface PlanApprovalProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
  className?: string;
}

// Tool emoji mapping - no Lucide icons
const toolEmojis: Record<string, string> = {
  web_search: '🔍',
  document_generator: '📄',
  image_generator: '🖼️',
  spreadsheet_generator: '📊',
  code_executor: '💻',
  analysis: '📈',
};

export function PlanApproval({
  task,
  steps,
  onApprove,
  onReject,
  onEdit,
  isLoading,
  className,
}: PlanApprovalProps) {
  // Parse plan from task
  const plan = task.plan_json;
  const planSteps = plan?.steps || steps.map(s => ({
    number: s.step_number,
    tool: s.tool_name,
    description: s.description,
  }));

  return (
    <div className={cn('space-y-6 animate-fade-in', className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-foreground">Review Execution Plan</h3>
        {task.plan_summary && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {task.plan_summary}
          </p>
        )}
      </div>

      {/* Steps Preview */}
      <div className="bg-muted/20 rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-foreground">
            Planned Steps
          </h4>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {planSteps.length} steps
          </span>
        </div>
        
        <div className="space-y-2">
          {planSteps.map((step: any, index: number) => {
            const emoji = toolEmojis[step.tool] || '⚡';
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/50 hover:border-border transition-colors"
              >
                {/* Step number - Swiss minimalist */}
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    {step.number || index + 1}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{emoji}</span>
                    <span className="text-sm font-medium text-foreground">
                      {step.tool ? step.tool.replace(/_/g, ' ') : 'Action'}
                    </span>
                  </div>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated Info */}
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span>Estimated time: ~{planSteps.length * 15}s</span>
        <span>·</span>
        <span>{planSteps.length} steps total</span>
      </div>

      {/* Action Buttons - Text only, minimal */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <Button
          variant="ghost"
          onClick={onReject}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
        
        {onEdit && (
          <>
            <span className="text-muted-foreground">·</span>
            <Button
              variant="ghost"
              onClick={onEdit}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Edit Plan
            </Button>
          </>
        )}
        
        <span className="text-muted-foreground">·</span>
        
        <Button
          onClick={onApprove}
          disabled={isLoading}
          size="default"
        >
          Approve & Start
        </Button>
      </div>
    </div>
  );
}
