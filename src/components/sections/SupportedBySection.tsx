import bscLogo from "@/assets/partners/bsc-ai-factory.png";
import nvidiaLogo from "@/assets/partners/nvidia-inception.png";

export const SupportedBySection = () => {
  return (
    <section className="py-16 bg-background border-t border-border/50">
      <div className="container mx-auto px-4">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
          AI Innovative Company Supported by
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <div className="bg-white/90 dark:bg-white rounded-2xl px-8 py-6 shadow-sm">
            <img
              src={bscLogo}
              alt="BSC AI Factory"
              className="h-16 md:h-20 w-auto object-contain"
            />
          </div>
          <div className="bg-white/90 dark:bg-white rounded-2xl px-8 py-6 shadow-sm">
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
