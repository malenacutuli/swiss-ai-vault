import { Circle } from '@/icons';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ModelStatusIndicatorProps {
  model: string;
  className?: string;
}

export function ModelStatusIndicator({ model, className }: ModelStatusIndicatorProps) {
  // Check if model is open-source (needs GPU)
  const isOpenSource = ['llama', 'mistral', 'qwen', 'deepseek', 'gemma', 'phi'].some(
    name => model.toLowerCase().includes(name)
  );
  
  // Commercial models are always ready
  if (!isOpenSource) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Circle className={cn("w-2 h-2 fill-green-500 text-green-500", className)} />
        </TooltipTrigger>
        <TooltipContent>Model ready</TooltipContent>
      </Tooltip>
    );
  }
  
  // For open-source, show warning that it may need warm-up
  return (
    <Tooltip>
      <TooltipTrigger>
        <Circle className={cn("w-2 h-2 fill-yellow-500 text-yellow-500", className)} />
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <div className="font-medium">Open-Source Model</div>
          <div className="text-muted-foreground">May need 30-60s to warm up on first use</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
