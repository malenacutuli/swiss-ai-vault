import { useState } from 'react';
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
  Zap, 
  Crown, 
  Check,
  Clock,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GhostUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType?: 'prompt' | 'image' | 'video' | 'file' | 'search';
  currentTier?: string;
}

const PLANS = [
  {
    id: 'ghost_pro',
    name: 'Ghost Pro',
    price: 15,
    icon: Zap,
    features: [
      'Unlimited prompts',
      '50 images per day',
      '20 videos per day',
      'GPT-4o, Claude, Gemini access',
      'Unlimited file uploads',
      'Priority support',
    ],
    highlight: true,
  },
  {
    id: 'swissvault_pro',
    name: 'SwissVault Pro',
    price: 49,
    icon: Crown,
    features: [
      'Everything in Ghost Pro',
      '100 images per day',
      '50 videos per day',
      'Vault Chat (RAG)',
      'Fine-tuning access',
      'API access',
      'Team features',
    ],
    highlight: false,
  },
];

const LIMIT_MESSAGES: Record<string, string> = {
  prompt: "You've used all your prompts for today",
  image: "You've used all your image generations for today",
  video: "You've used all your video generations for today",
  file: "You've reached your file upload limit for today",
  search: "You've used all your web searches for today",
};

export function GhostUpgradeModal({
  open,
  onOpenChange,
  limitType = 'prompt',
  currentTier = 'ghost_free',
}: GhostUpgradeModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to upgrade');
        onOpenChange(false);
        navigate('/auth');
        return;
      }

      // Call create-checkout function with Ghost tier
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          productId: planId,
          productType: 'ghost_subscription',
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout');
      }

      if (data?.url) {
        // Redirect to Stripe checkout in new tab
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error('No checkout URL received');
      }
      
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const limitMessage = LIMIT_MESSAGES[limitType] || LIMIT_MESSAGES.prompt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Daily Limit Reached
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {limitMessage}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground text-center">
          Upgrade to continue using Ghost Chat without limits.
        </p>

        <div className="grid gap-4 pt-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentTier === plan.id;
            
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative p-4 rounded-xl border transition-all",
                  plan.highlight 
                    ? "border-primary/50 bg-primary/5" 
                    : "border-border bg-card",
                  isCurrentPlan && "opacity-60"
                )}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground">
                    RECOMMENDED
                  </Badge>
                )}
                
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    plan.highlight ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      plan.highlight ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-lg font-bold text-foreground">${plan.price}</span>
                      /month
                    </p>
                  </div>
                </div>
                
                <ul className="space-y-1.5 mb-4">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 4 && (
                    <li className="text-xs text-muted-foreground pl-6">
                      +{plan.features.length - 4} more features
                    </li>
                  )}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading !== null || isCurrentPlan}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    'Upgrade'
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 pt-2">
          <Clock className="w-3.5 h-3.5" />
          Or come back tomorrow for more free usage
        </p>
      </DialogContent>
    </Dialog>
  );
}
