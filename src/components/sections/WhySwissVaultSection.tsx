import { Shield, Lock, Server, ArrowRight } from "@/icons";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { useTranslation } from "react-i18next";

export const WhySwissVaultSection = () => {
  const { t } = useTranslation();

  const pillars = [
    {
      icon: Lock,
      titleKey: "home.whySwissVault.zeroKnowledge.title",
      descriptionKey: "home.whySwissVault.zeroKnowledge.description",
      detailsKey: "home.whySwissVault.zeroKnowledge.details",
    },
    {
      icon: Server,
      titleKey: "home.whySwissVault.swissResidency.title",
      descriptionKey: "home.whySwissVault.swissResidency.description",
      detailsKey: "home.whySwissVault.swissResidency.details",
      useSwissFlag: true,
    },
    {
      icon: Shield,
      titleKey: "home.whySwissVault.fullLifecycle.title",
      descriptionKey: "home.whySwissVault.fullLifecycle.description",
      detailsKey: "",
    },
  ];

  return (
    <section id="why-swissvault" className="py-20 relative">
      <div className="absolute inset-0 gradient-swiss opacity-40" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('home.whySwissVault.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('home.whySwissVault.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.titleKey}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                {pillar.useSwissFlag ? (
                  <SwissFlag className="h-6 w-6" />
                ) : (
                  <pillar.icon className="h-6 w-6 text-primary" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(pillar.titleKey)}</h3>
              <p className="text-muted-foreground text-sm mb-3">
                {t(pillar.descriptionKey)}
              </p>
              {pillar.detailsKey && (
                <p className="text-xs text-muted-foreground/70 border-t border-border/30 pt-3">
                  {t(pillar.detailsKey)}
                </p>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
