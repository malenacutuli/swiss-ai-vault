import bscLogo from "@/assets/partners/bsc-ai-factory.png";
import nvidiaLogo from "@/assets/partners/nvidia-inception.png";

export const SupportedBySection = () => {
  return (
    <section className="py-16 bg-background border-t border-border/50">
      <div className="container mx-auto px-4">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
          AI Innovative Company Supported by
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
          <img
            src={bscLogo}
            alt="BSC AI Factory"
            className="h-12 md:h-14 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
          />
          <img
            src={nvidiaLogo}
            alt="NVIDIA Inception Program"
            className="h-10 md:h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </section>
  );
};
