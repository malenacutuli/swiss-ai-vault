import { cn } from "@/lib/utils";

type Status = 
  | "setup" 
  | "dataset" 
  | "finetuning" 
  | "evaluation" 
  | "complete"
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "training"
  | "completed"
  | "failed"
  | "queued"
  | "running"
  | "cancelled";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  setup: { label: "Setup", className: "bg-muted text-muted-foreground" },
  dataset: { label: "Dataset", className: "bg-primary/10 text-primary" },
  finetuning: { label: "Fine-tuning", className: "bg-warning/10 text-warning" },
  evaluation: { label: "Evaluation", className: "bg-secondary/10 text-secondary" },
  complete: { label: "Complete", className: "bg-success/10 text-success" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-primary/10 text-primary animate-pulse-subtle" },
  ready: { label: "Ready", className: "bg-success/10 text-success" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive" },
  training: { label: "Training", className: "bg-warning/10 text-warning animate-pulse-subtle" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  queued: { label: "Queued", className: "bg-warning/10 text-warning" },
  running: { label: "Running", className: "bg-primary/10 text-primary animate-pulse-subtle" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
