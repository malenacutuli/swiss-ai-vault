import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X, FileText, Image, Table, Search, Edit } from 'lucide-react';
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

const toolIcons: Record<string, typeof FileText> = {
  web_search: Search,
  document_generator: FileText,
  image_generator: Image,
  spreadsheet_generator: Table,
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
    <div className={cn('space-y-6', className)}>
      {/* Plan Summary */}
      {task.plan_summary && (
        <div className="text-center">
          <p className="text-lg text-foreground">{task.plan_summary}</p>
        </div>
      )}

      {/* Steps Preview */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          Planned Steps ({planSteps.length})
        </h4>
        
        {planSteps.map((step: any, index: number) => {
          const Icon = toolIcons[step.tool] || FileText;
          return (
            <div
              key={index}
              className="flex items-start gap-3 py-2"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {step.number || index + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {step.tool || 'Action'}
                  </span>
                </div>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Estimated Info */}
      <div className="flex justify-center gap-6 text-sm text-muted-foreground">
        <span>~{planSteps.length * 15}s estimated</span>
        <span>•</span>
        <span>{planSteps.length} steps</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={onReject}
          disabled={isLoading}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        
        {onEdit && (
          <Button
            variant="outline"
            onClick={onEdit}
            disabled={isLoading}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Plan
          </Button>
        )}
        
        <Button
          onClick={onApprove}
          disabled={isLoading}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Check className="h-4 w-4" />
          Approve & Start
        </Button>
      </div>
    </div>
  );
}
