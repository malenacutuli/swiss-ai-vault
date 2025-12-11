import bscLogo from "@/assets/partners/bsc-ai-factory.png";
import nvidiaLogo from "@/assets/partners/nvidia-inception.png";
import aiFactoriesLogo from "@/assets/partners/ai-factories.png";
import { useTranslation } from "react-i18next";

export const SupportedBySection = () => {
  const { t } = useTranslation();
  
  const partners = [
    { logo: bscLogo, alt: "BSC AI Factory" },
    { logo: nvidiaLogo, alt: "NVIDIA Inception Program" },
    { logo: aiFactoriesLogo, alt: "AI Factories" },
  ];
  
  return (
    <section className="py-16 bg-background border-t border-border/50">
      <div className="container mx-auto px-4">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
          {t('home.supportedBy.title')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
          {partners.map((partner, index) => (
            <div 
              key={index}
              className="h-12 md:h-16 flex items-center justify-center"
            >
              <img
                src={partner.logo}
                alt={partner.alt}
                className="h-full w-auto object-contain grayscale opacity-60 hover:opacity-80 transition-opacity"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
