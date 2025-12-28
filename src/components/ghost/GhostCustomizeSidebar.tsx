import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { 
  Compass, TrendingUp, Scale, Lightbulb, BookOpen, 
  Shield, Plane, Activity, Home, Palette, Users, LucideIcon
} from 'lucide-react';

interface Module {
  id: string;
  name: string;
  icon: LucideIcon;
  isPro?: boolean;
}

const ALL_MODULES: Module[] = [
  { id: 'discover', name: 'Discover', icon: Compass },
  { id: 'finance', name: 'Finance', icon: TrendingUp },
  { id: 'legal', name: 'Legal', icon: Scale },
  { id: 'patents', name: 'Patents', icon: Lightbulb },
  { id: 'research', name: 'Research', icon: BookOpen },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'travel', name: 'Travel', icon: Plane },
  { id: 'health', name: 'Health', icon: Activity, isPro: true },
  { id: 'realestate', name: 'Real Estate', icon: Home, isPro: true },
  { id: 'art', name: 'Art & Collectibles', icon: Palette, isPro: true },
  { id: 'familyoffice', name: 'Family Office', icon: Users, isPro: true },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledModules: string[];
  onSave: (modules: string[]) => void;
}

export function GhostCustomizeSidebar({ open, onOpenChange, enabledModules, onSave }: Props) {
  const toggleModule = (id: string) => {
    const newModules = enabledModules.includes(id)
      ? enabledModules.filter(m => m !== id)
      : [...enabledModules, id];
    onSave(newModules);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Sidebar</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select the items that appear in your sidebar
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {ALL_MODULES.map((module) => {
            const Icon = module.icon;
            const isEnabled = enabledModules.includes(module.id);
            
            return (
              <div
                key={module.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{module.name}</span>
                  {module.isPro && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      PRO
                    </span>
                  )}
                </div>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleModule(module.id)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
