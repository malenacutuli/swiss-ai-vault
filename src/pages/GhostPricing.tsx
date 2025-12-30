import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Check, Ghost, ArrowLeft } from '@/icons';

const TIERS = [
  {
    name: 'Anonymous',
    price: 'Free',
    description: 'No signup needed',
    features: [
      '10 prompts per day',
      'SwissVault model',
      'Zero data retention',
      'Single session',
    ],
    cta: 'Current',
    disabled: true,
  },
  {
    name: 'Ghost Free',
    price: '$0',
    period: '/month',
    description: 'For casual users',
    features: [
      '15 prompts per day',
      '3 images per day',
      'Save conversations',
      'End-to-end encryption',
    ],
    cta: 'Sign Up Free',
    href: '/auth?intent=ghost',
  },
  {
    name: 'Ghost Pro',
    price: '$15',
    period: '/month',
    description: 'For power users',
    popular: true,
    features: [
      'Unlimited prompts',
      '50 images per day',
      'GPT-4o, Claude, Gemini',
      'Priority support',
    ],
    cta: 'Get Pro',
    href: '/auth?intent=ghost&plan=ghost_pro',
  },
  {
    name: 'SwissVault Pro',
    price: '$49',
    period: '/month',
    description: 'Full platform',
    features: [
      'Everything in Ghost Pro',
      'Vault Chat (RAG)',
      'Fine-tuning access',
      'API access',
    ],
    cta: 'Get SwissVault',
    href: '/auth?intent=ghost&plan=swissvault_pro',
  },
];

export default function GhostPricing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ghost')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Ghost className="h-6 w-6 text-primary" />
            <span className="font-semibold">Ghost Chat</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple Pricing</h1>
          <p className="text-muted-foreground text-lg">
            Start free, upgrade when you need more
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-6 flex flex-col ${
                tier.popular
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                  POPULAR
                </div>
              )}

              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold">{tier.price}</span>
                {tier.period && (
                  <span className="text-muted-foreground">{tier.period}</span>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {tier.description}
              </p>

              <ul className="space-y-3 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? 'default' : 'outline'}
                className="w-full"
                disabled={tier.disabled}
                onClick={() => tier.href && navigate(tier.href)}
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground text-sm mt-12">
          All plans include Swiss privacy and zero data retention on servers.
        </p>
      </main>
    </div>
  );
}
