import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const HeroSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{t('landing.hero.badge')}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Fine-tune AI Models with{" "}
            <span className="text-gradient">Swiss Precision</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up animate-delay-100">
            {t('landing.hero.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up animate-delay-200">
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth">
                {t('landing.hero.cta')}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" asChild>
              <Link to="/docs/api">
                {t('landing.hero.docs')}
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto animate-slide-up animate-delay-300">
            <div className="flex flex-col items-center p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-2xl font-bold">10x</span>
              </div>
              <span className="text-sm text-muted-foreground">Faster Training</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Shield className="h-4 w-4" />
                <span className="text-2xl font-bold">100%</span>
              </div>
              <span className="text-sm text-muted-foreground">Swiss Hosted</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Globe className="h-4 w-4" />
                <span className="text-2xl font-bold">7+</span>
              </div>
              <span className="text-sm text-muted-foreground">Base Models</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
