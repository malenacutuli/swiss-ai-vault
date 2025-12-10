import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Database, Brain, Workflow, MessageSquare, Shield } from "lucide-react";
import { useState } from "react";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { useTranslation } from "react-i18next";

export const HeroSection = () => {
  const { t } = useTranslation();
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  
  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background Effects */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left">

              {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 animate-slide-up">
                {t('home.hero.title')}{" "}
                <span className="text-gradient">{t('home.hero.titleHighlight')}</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 animate-slide-up animate-delay-100">
                <span className="font-semibold text-foreground">{t('home.hero.subtitle')}</span>{" "}
                {t('home.hero.description')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6 animate-slide-up animate-delay-200">
                <Button variant="hero" size="xl" onClick={() => setDemoOpen(true)}>
                  {t('home.hero.bookDemo')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button variant="glass" size="xl" onClick={() => setEarlyAccessOpen(true)}>
                  {t('home.hero.earlyAccess')}
                </Button>
              </div>

              {/* Trust micro-copy */}
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground animate-slide-up animate-delay-300">
                <div className="flex items-center gap-1.5">
                  <SwissFlag className="h-4 w-4" />
                  <span>{t('home.hero.hostedInSwitzerland')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-success" />
                  <span>{t('home.hero.gdprReady')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>{t('home.hero.e2eEncryption')}</span>
                </div>
              </div>
            </div>

            {/* Right: Mock UI Preview */}
            <div className="relative animate-slide-up animate-delay-200">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-elevated">
                {/* Window header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[hsl(0_0%_24%)]" />
                    <div className="w-3 h-3 rounded-full bg-[hsl(0_0%_24%)]" />
                    <div className="w-3 h-3 rounded-full bg-[hsl(0_0%_24%)]" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground ml-2">{t('home.mockUI.workspaceTitle')}</span>
                </div>

                {/* Content */}
                <div className="p-4 grid grid-cols-3 gap-4">
                  {/* Main chat area */}
                  <div className="col-span-2 space-y-3">
                    {/* Chat header with encryption badge */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{t('home.mockUI.complianceCopilot')}</div>
                          <div className="text-xs text-muted-foreground">{t('home.mockUI.complianceCopilotDesc')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
                        <Lock className="h-3 w-3 text-success" />
                        <span className="text-xs text-success font-medium">{t('home.mockUI.e2eEncrypted')}</span>
                      </div>
                    </div>

                    {/* Sample messages */}
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/20 max-w-[85%]">
                        <p className="text-sm text-muted-foreground">{t('home.mockUI.sampleQuestion')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 max-w-[85%] ml-auto">
                        <p className="text-sm">{t('home.mockUI.sampleAnswer')}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          <span>{t('home.mockUI.encryptedResponse')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Side tiles */}
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                      <Database className="h-4 w-4 text-primary mb-1" />
                      <div className="text-xs font-medium">{t('home.mockUI.datasets')}</div>
                      <div className="text-xs text-muted-foreground">{t('home.mockUI.sources')}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                      <Brain className="h-4 w-4 text-primary mb-1" />
                      <div className="text-xs font-medium">{t('home.mockUI.fineTuned')}</div>
                      <div className="text-xs text-muted-foreground">{t('home.mockUI.modelsCount')}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                      <Workflow className="h-4 w-4 text-primary mb-1" />
                      <div className="text-xs font-medium">{t('home.mockUI.evaluations')}</div>
                      <div className="text-xs text-muted-foreground">{t('home.mockUI.accuracy')}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="flex gap-1 mb-1">
                        <div className="w-4 h-4 rounded bg-[#4A154B] flex items-center justify-center text-[8px] text-white font-bold">S</div>
                        <div className="w-4 h-4 rounded bg-[#000] flex items-center justify-center text-[8px] text-white font-bold">N</div>
                        <div className="w-4 h-4 rounded bg-[#333] flex items-center justify-center text-[8px] text-white font-bold">G</div>
                      </div>
                      <div className="text-xs font-medium">{t('home.mockUI.ragSources')}</div>
                      <div className="text-xs text-muted-foreground">Slack, Notion, GitHub</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl animate-pulse" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-success/10 rounded-full blur-2xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <EarlyAccessModal open={earlyAccessOpen} onOpenChange={setEarlyAccessOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
