import { cn } from "@/lib/utils";
import { MessageSquare, Code } from "lucide-react";

interface PlaygroundModeToggleProps {
  mode: "chat" | "code";
  onModeChange: (mode: "chat" | "code") => void;
}

export function PlaygroundModeToggle({ mode, onModeChange }: PlaygroundModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
      <button
        onClick={() => onModeChange("chat")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          mode === "chat"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </button>
      <button
        onClick={() => onModeChange("code")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          mode === "code"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <Code className="h-4 w-4" />
        Code
      </button>
    </div>
  );
}
