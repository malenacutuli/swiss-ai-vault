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
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center p-3 bg-transparent">
            <img
              src={bscLogo}
              alt="BSC AI Factory"
              className="w-full h-full object-contain grayscale brightness-0 invert opacity-80"
            />
          </div>
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center p-3 bg-transparent">
            <img
              src={nvidiaLogo}
              alt="NVIDIA Inception Program"
              className="w-full h-full object-contain grayscale brightness-0 invert opacity-80"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
