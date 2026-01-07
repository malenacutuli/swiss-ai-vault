import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutputTypeCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
  onGenerate: (id: string) => void;
}

export function OutputTypeCard({
  id,
  title,
  description,
  icon: Icon,
  disabled = false,
  onGenerate,
}: OutputTypeCardProps) {
  return (
    <div
      className={cn(
        'group flex flex-col p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-white/5 rounded-lg">
          <Icon className="w-5 h-5 text-[#e63946]" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white mb-0.5">{title}</h3>
          <p className="text-xs text-white/50 line-clamp-2">{description}</p>
        </div>
      </div>
      
      <Button
        size="sm"
        onClick={() => onGenerate(id)}
        disabled={disabled}
        className="w-full mt-auto bg-[#e63946] hover:bg-[#e63946]/90 text-white text-xs h-8"
      >
        Generate
      </Button>
    </div>
  );
}
