import { Lock, Shield, Server, FileCheck, Download, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { useState } from "react";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { useTranslation } from "react-i18next";

export const SecuritySection = () => {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);

  const securityFeatures = [
    {
      icon: Lock,
      titleKey: "home.security.e2e.title",
      points: [
        t('home.security.e2e.point1'),
        t('home.security.e2e.point2'),
      ],
    },
    {
      icon: Shield,
      titleKey: "home.security.zeroTrust.title",
      points: [
        t('home.security.zeroTrust.point1'),
        t('home.security.zeroTrust.point2'),
        t('home.security.zeroTrust.point3'),
      ],
    },
    {
      icon: Server,
      titleKey: "home.security.swissResidency.title",
      points: [
        t('home.security.swissResidency.point1'),
        t('home.security.swissResidency.point2'),
      ],
    },
    {
      icon: FileCheck,
      titleKey: "home.security.complianceRoadmap.title",
      points: [
        t('home.security.complianceRoadmap.point1'),
        t('home.security.complianceRoadmap.point2'),
      ],
    },
  ];

  return (
    <>
      <section id="security" className="py-24 relative">
        <div className="absolute inset-0 gradient-swiss opacity-40" />
        
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-primary uppercase tracking-wide">{t('home.security.badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('home.security.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('home.security.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
            {/* Left: Security features */}
            <div className="space-y-6">
              {securityFeatures.map((feature) => (
                <div key={feature.titleKey} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{t(feature.titleKey)}</h3>
                    <ul className="space-y-1">
                      {feature.points.map((point, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Architecture diagram */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <h4 className="font-semibold mb-6 text-center">{t('home.security.architecture.title')}</h4>
              
              <div className="space-y-4">
                {/* Browser layer */}
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">{t('home.security.architecture.browser.title')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('home.security.architecture.browser.description')}
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="w-px h-8 bg-border" />
                </div>

                {/* SwissVault layer */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t('home.security.architecture.backend.title')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('home.security.architecture.backend.description')}
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="w-px h-8 bg-border" />
                </div>

                {/* Swiss infrastructure */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <SwissFlag className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('home.security.architecture.infrastructure.title')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('home.security.architecture.infrastructure.description')}
                  </p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button variant="outline" size="sm" className="gap-2 flex-1">
                  <Download className="h-4 w-4" />
                  {t('home.security.downloadWhitepaper')}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 flex-1" onClick={() => setDemoOpen(true)}>
                  <MessageSquare className="h-4 w-4" />
                  {t('home.security.talkToCISO')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
