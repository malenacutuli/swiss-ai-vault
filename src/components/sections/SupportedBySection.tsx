import bscLogo from "@/assets/partners/bsc-ai-factory.png";
import nvidiaLogo from "@/assets/partners/nvidia-inception.png";
import { useTranslation } from "react-i18next";

export const SupportedBySection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-16 bg-background border-t border-border/50">
      <div className="container mx-auto px-4">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
          {t('home.supportedBy.title')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <img
              src={bscLogo}
              alt="BSC AI Factory"
              className="h-14 md:h-16 w-auto object-contain"
            />
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <img
              src={nvidiaLogo}
              alt="NVIDIA Inception Program"
              className="h-14 md:h-16 w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
