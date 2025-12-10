import { Database, Cpu, BarChart3, Lock, Zap, Code2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const FeaturesSection = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Database,
      titleKey: "landing.features.dataset.title",
      descriptionKey: "landing.features.dataset.description",
    },
    {
      icon: Cpu,
      titleKey: "landing.features.finetuning.title",
      descriptionKey: "landing.features.finetuning.description",
    },
    {
      icon: BarChart3,
      titleKey: "landing.features.evaluation.title",
      descriptionKey: "landing.features.evaluation.description",
    },
    {
      icon: Lock,
      titleKey: "landing.features.swiss.title",
      descriptionKey: "landing.features.swiss.description",
    },
    {
      icon: Zap,
      titleKey: "landing.features.inference.title",
      descriptionKey: "landing.features.inference.description",
    },
    {
      icon: Code2,
      titleKey: "landing.features.sdk.title",
      descriptionKey: "landing.features.sdk.description",
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 gradient-swiss opacity-50" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.titleKey}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t(feature.descriptionKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
