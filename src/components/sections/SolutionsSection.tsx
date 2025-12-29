import { FileCheck, Code2, Building2, ArrowRight } from "@/icons";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { useTranslation } from "react-i18next";

export const SolutionsSection = () => {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);

  const solutions = [
    {
      icon: FileCheck,
      titleKey: "home.solutions.compliance.title",
      descriptionKey: "home.solutions.compliance.description",
      features: [
        t('home.solutions.compliance.feature1'),
        t('home.solutions.compliance.feature2'),
      ],
    },
    {
      icon: Code2,
      titleKey: "home.solutions.developer.title",
      descriptionKey: "home.solutions.developer.description",
      features: [
        t('home.solutions.developer.feature1'),
      ],
    },
    {
      icon: Building2,
      titleKey: "home.solutions.banking.title",
      descriptionKey: "home.solutions.banking.description",
      features: [
        t('home.solutions.banking.feature1'),
        t('home.solutions.banking.feature2'),
      ],
    },
  ];

  return (
    <>
      <section id="solutions" className="py-24 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-normal tracking-[-0.045em] leading-[1.07] mb-4 text-foreground">
              {t('home.solutions.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('home.solutions.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {solutions.map((solution) => (
              <div
                key={solution.titleKey}
                className="group p-6 rounded-2xl bg-card border border-border/60 hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <solution.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(solution.titleKey)}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t(solution.descriptionKey)}
                </p>
                <ul className="space-y-2">
                  {solution.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button variant="outline" className="gap-2" onClick={() => setDemoOpen(true)}>
              {t('home.solutions.exploreSolutions')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
