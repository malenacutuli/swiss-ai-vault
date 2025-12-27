import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, Shield, Zap, Globe, Server, MessageSquare, 
  ArrowRight, Check, EyeOff, Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GhostLanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect authenticated users to chat
  useEffect(() => {
    if (!loading && user) {
      navigate('/ghost/chat');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <EyeOff className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Ghost Chat</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">by SwissVault.ai</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/ghost/chat')}>
              Try Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 gap-2">
            <Shield className="w-3 h-3" />
            Zero data retention • Swiss privacy
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Private AI Chat
            <br />
            <span className="text-primary">No Account Needed</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Chat with AI without creating an account. Your conversations are never 
            stored on our servers. Try free—10 prompts, no signup required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button size="lg" className="gap-2" onClick={() => navigate('/ghost/chat')}>
              Start Chatting Free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth/ghost-signup')}>
              Sign Up for 15/day
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            No credit card • No email for anonymous use
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Ghost Chat?</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: EyeOff, title: 'Zero Data Retention', desc: "Messages never stored on servers. We can't read, sell, or hand over what we don't have." },
              { icon: Globe, title: 'Swiss Privacy', desc: "AI hosted in Switzerland. Protected by world's strongest privacy laws, outside US CLOUD Act." },
              { icon: Zap, title: 'No Account Needed', desc: 'Start chatting immediately. No email, no password, no tracking.' },
              { icon: Lock, title: 'End-to-End Encryption', desc: 'When you sign up, conversations encrypted with keys only you control.' },
              { icon: Server, title: 'Open Source Models', desc: 'Powered by open-source AI. No data sent to OpenAI, Google, or big tech.' },
              { icon: MessageSquare, title: 'Full Featured', desc: 'Not a demo. Full AI chat with images, files, web search, and more.' },
            ].map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
          <p className="text-muted-foreground text-center mb-12">Start free, upgrade when you need more</p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Anonymous */}
            <PricingCard
              name="Anonymous"
              price="Free"
              description="Try without signup"
              features={['10 prompts per day', '3 images per day', 'No account needed', 'Zero data retention']}
              cta="Try Now"
              onCta={() => navigate('/ghost/chat')}
            />
            
            {/* Ghost Free */}
            <PricingCard
              name="Ghost Free"
              price="$0"
              period="/month"
              description="For casual users"
              features={['15 prompts per day', '5 images per day', 'Save conversations', 'End-to-end encryption']}
              cta="Sign Up Free"
              onCta={() => navigate('/auth/ghost-signup')}
              highlight
              badge="POPULAR"
            />
            
            {/* Ghost Pro */}
            <PricingCard
              name="Ghost Pro"
              price="$15"
              period="/month"
              description="For power users"
              features={['Unlimited prompts', '50 images per day', 'GPT-4o, Claude, Gemini', 'Priority support']}
              cta="Get Pro"
              onCta={() => navigate('/auth/ghost-signup?plan=ghost_pro')}
            />
            
            {/* SwissVault Pro */}
            <PricingCard
              name="SwissVault Pro"
              price="$49"
              period="/month"
              description="For teams & pros"
              features={['Everything in Pro', 'Vault Chat (RAG)', 'Fine-tuning access', 'API access']}
              cta="Get SwissVault"
              onCta={() => navigate('/auth/ghost-signup?plan=swissvault_pro')}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to chat privately?</h2>
          <p className="text-muted-foreground mb-8">No signup, no tracking. Just start typing.</p>
          <Button size="lg" className="gap-2" onClick={() => navigate('/ghost/chat')}>
            Try Ghost Chat Free
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <EyeOff className="w-4 h-4" />
            Ghost Chat by SwissVault.ai
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/" className="hover:text-foreground transition-colors">SwissVault.ai</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Pricing Card Component
function PricingCard({ 
  name, price, period, description, features, cta, onCta, highlight, badge 
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  onCta: () => void;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className={cn(
      "relative p-6 rounded-xl border transition-all",
      highlight 
        ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" 
        : "border-border bg-card hover:border-primary/30"
    )}>
      {badge && (
        <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground">
          {badge}
        </Badge>
      )}
      <h3 className="text-lg font-semibold mb-2">{name}</h3>
      <div className="mb-3">
        <span className="text-3xl font-bold">{price}</span>
        {period && <span className="text-muted-foreground">{period}</span>}
      </div>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      
      <ul className="space-y-3 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      
      <Button 
        className="w-full" 
        variant={highlight ? "default" : "outline"}
        onClick={onCta}
      >
        {cta}
      </Button>
    </div>
  );
}
