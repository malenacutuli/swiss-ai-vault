import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Database, Brain, Workflow, MessageSquare } from "@/icons";
import { useState } from "react";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { useTranslation } from "react-i18next";

export const EnterpriseSection = () => {
  const { t } = useTranslation();
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-background" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.2), transparent 70%)"
          }}
        />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Mock UI Preview (moved from hero) */}
            <div className="relative order-2 lg:order-1">
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-elevated">
                {/* Window header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
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
            </div>

            {/* Right: Enterprise CTA */}
            <div className="text-center lg:text-left order-1 lg:order-2">
              <h3 className="text-2xl sm:text-3xl font-semibold mb-4 text-foreground">
                {t('home.hero.title')} {t('home.hero.titleHighlight')}
              </h3>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
                <span className="text-foreground">{t('home.hero.subtitle')}</span>{" "}
                {t('home.hero.description')}
              </p>

              {/* Enterprise CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button variant="hero" size="xl" onClick={() => setDemoOpen(true)}>
                  {t('home.hero.bookDemo')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button variant="glass" size="xl" onClick={() => setEarlyAccessOpen(true)}>
                  {t('home.hero.earlyAccess')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <EarlyAccessModal open={earlyAccessOpen} onOpenChange={setEarlyAccessOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
