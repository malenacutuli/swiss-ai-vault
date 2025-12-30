import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Shield } from "@/icons";

import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const HeroSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at 50% 50%, hsl(var(--border) / 0.4), transparent 70%)"
        }}
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-[-0.055em] leading-[1.02] mb-6 animate-slide-up text-foreground">
              {t('home.hero.title')}{" "}
              <span className="text-primary">{t('home.hero.titleHighlight')}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 animate-slide-up animate-delay-100">
              {t('home.hero.description')}
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6 animate-slide-up animate-delay-200">
              <Button variant="hero" size="xl" asChild>
                <Link to="/ghost">
                  {t('home.hero.tryGhostChat')}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Trust micro-copy */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground animate-slide-up animate-delay-300">
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 32 32" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="4" fill="#dc2626"/>
                  <path d="M14 8H18V14H24V18H18V24H14V18H8V14H14V8Z" fill="white"/>
                </svg>
                <span>{t('home.hero.hostedInSwitzerland')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-success" />
                <span>{t('home.hero.noLoginRequired')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" />
                <span>{t('home.hero.zeroDataStored')}</span>
              </div>
            </div>
          </div>

          {/* Right: Ghost Chat Video */}
          <div className="relative animate-slide-up animate-delay-200">
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-elevated">
              <video
                className="w-full h-auto"
                autoPlay
                loop
                muted
                playsInline
                poster="/videos/ghost-chat-hero.mov"
              >
                <source src="/videos/ghost-chat-hero.mov" type="video/quicktime" />
                <source src="/videos/ghost-chat-hero.mov" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            
            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-full bg-success/20 border border-success/30 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-medium text-success">100% Anonymous</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
