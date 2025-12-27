import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Zap, 
  Image, 
  Video, 
  Search, 
  FileUp, 
  Clock, 
  Check,
  Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: 'prompts' | 'images' | 'videos' | 'files' | 'searches' | 'model';
  remaining?: {
    prompts: number;
    images: number;
    videos: number;
    files: number;
    searches: number;
  };
  resetTime?: Date;
}

const LIMIT_MESSAGES: Record<string, { icon: React.ElementType; title: string; description: string }> = {
  prompts: {
    icon: Zap,
    title: 'Daily Prompt Limit Reached',
    description: "You've used all your free prompts for today.",
  },
  images: {
    icon: Image,
    title: 'Daily Image Limit Reached',
    description: "You've used all your free image generations for today.",
  },
  videos: {
    icon: Video,
    title: 'Daily Video Limit Reached',
    description: "You've used all your free video generations for today.",
  },
  files: {
    icon: FileUp,
    title: 'Daily File Upload Limit Reached',
    description: "You've used all your free file uploads for today.",
  },
  searches: {
    icon: Search,
    title: 'Daily Search Limit Reached',
    description: "You've used all your free web searches for today.",
  },
  model: {
    icon: Crown,
    title: 'Pro Model Access Required',
    description: 'This model requires Ghost Pro subscription.',
  },
};

const PRO_FEATURES = [
  { icon: Zap, text: 'Unlimited prompts' },
  { icon: Image, text: '50 images per day' },
  { icon: Video, text: '20 videos per day' },
  { icon: FileUp, text: '50 file uploads per day' },
  { icon: Search, text: 'Unlimited web searches' },
  { icon: Crown, text: 'GPT-4o, Claude, Gemini access' },
];

export function GhostUpgradeModal({
  open,
  onOpenChange,
  reason = 'prompts',
  remaining,
  resetTime,
}: GhostUpgradeModalProps) {
  const navigate = useNavigate();
  const limitInfo = LIMIT_MESSAGES[reason] || LIMIT_MESSAGES.prompts;
  const LimitIcon = limitInfo.icon;

  const getTimeUntilReset = () => {
    if (!resetTime) return null;
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const timeUntilReset = getTimeUntilReset();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing?plan=ghost_pro');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <LimitIcon className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            {limitInfo.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {limitInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Pro Card */}
          <div className="relative p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
            <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" />
              Recommended
            </Badge>
            
            <div className="pt-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Ghost Pro
                <span className="text-sm font-normal text-muted-foreground">$15/month</span>
              </h3>
              
              <ul className="mt-3 space-y-2">
                {PRO_FEATURES.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={handleUpgrade} className="w-full" size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
            
            {timeUntilReset && (
              <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Or come back in {timeUntilReset} for free credits
              </p>
            )}
          </div>

          {/* Current remaining (if any) */}
          {remaining && (remaining.prompts > 0 || remaining.images > 0 || remaining.videos > 0) && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Today's remaining: {remaining.prompts} prompts, {remaining.images} images, {remaining.videos} videos
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
