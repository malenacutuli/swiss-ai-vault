import { Shield, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface GroundedModeToggleProps {
  isGrounded: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  documentsCount?: number;
}

export function GroundedModeToggle({
  isGrounded,
  onToggle,
  disabled,
  documentsCount = 0,
}: GroundedModeToggleProps) {
  const canEnable = documentsCount > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isGrounded ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(!isGrounded)}
            disabled={disabled || (!isGrounded && !canEnable)}
            className={cn(
              "gap-2 transition-all",
              isGrounded && "bg-green-600 hover:bg-green-700 text-white border-green-600"
            )}
          >
            {isGrounded ? (
              <>
                <Shield className="h-4 w-4" />
                Grounded
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4" />
                Standard
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {isGrounded ? (
            <div className="space-y-1">
              <p className="font-medium text-sm">🔒 Grounded Mode Active</p>
              <p className="text-xs text-muted-foreground">
                AI uses lower temperature (0.3) and ONLY answers from your documents with citations. 
                Will refuse to answer if sources are insufficient.
              </p>
            </div>
          ) : canEnable ? (
            <div className="space-y-1">
              <p className="font-medium text-sm">Enable Grounded Mode</p>
              <p className="text-xs text-muted-foreground">
                Click for citation-backed responses. Uses your {documentsCount} document{documentsCount !== 1 ? 's' : ''} as the only source of truth.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-sm">No Documents Available</p>
              <p className="text-xs text-muted-foreground">
                Add documents to your memory to enable grounded mode.
              </p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
