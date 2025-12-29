import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/icons";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";

export const CTASection = () => {
  const { t } = useTranslation();
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  
  return (
    <>
      <section className="py-24 relative overflow-hidden">
        {/* Background - solid gradient, no blur blobs */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-[-0.045em] leading-[1.07] mb-6 text-foreground">
              {t('landing.cta.title')}{" "}
              <span className="text-primary">Swiss Precision?</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              {t('landing.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" onClick={() => setEarlyAccessOpen(true)}>
                {t('landing.cta.earlyAccess')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button variant="glass" size="xl" onClick={() => setDemoOpen(true)}>
                {t('landing.cta.demo')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              {t('landing.cta.noCard')}
            </p>
          </div>
        </div>
      </section>

      <EarlyAccessModal open={earlyAccessOpen} onOpenChange={setEarlyAccessOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
