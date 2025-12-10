import { Upload, Brain, Rocket, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const HowItWorksSection = () => {
  const { t } = useTranslation();

  const steps = [
    {
      number: "1",
      icon: Upload,
      titleKey: "home.howItWorks.step1.title",
      descriptionKey: "home.howItWorks.step1.description",
    },
    {
      number: "2",
      icon: Brain,
      titleKey: "home.howItWorks.step2.title",
      descriptionKey: "home.howItWorks.step2.description",
    },
    {
      number: "3",
      icon: Rocket,
      titleKey: "home.howItWorks.step3.title",
      descriptionKey: "home.howItWorks.step3.description",
    },
    {
      number: "4",
      icon: BarChart3,
      titleKey: "home.howItWorks.step4.title",
      descriptionKey: "home.howItWorks.step4.description",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute inset-0 gradient-swiss opacity-30" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/30 to-transparent hidden md:block" />

            <div className="space-y-8">
              {steps.map((step) => (
                <div key={step.titleKey} className="relative flex gap-6 group">
                  {/* Number circle */}
                  <div className="relative z-10 w-16 h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2 pb-8">
                    <h3 className="text-lg font-semibold mb-2">{t(step.titleKey)}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(step.descriptionKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
