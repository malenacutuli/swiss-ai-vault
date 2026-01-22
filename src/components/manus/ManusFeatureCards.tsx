import { cn } from "@/lib/utils";
import { Smartphone, Presentation, Globe, type LucideIcon } from "lucide-react";

interface FeatureCard {
  id: string;
  Icon: LucideIcon;
  title: string;
  onClick?: () => void;
}

const defaultFeatures: FeatureCard[] = [
  {
    id: "download-app",
    Icon: Smartphone,
    title: "Download app to access SwissBrAIn anytime and anywhere",
  },
  {
    id: "nano-banana",
    Icon: Presentation,
    title: "Generate slides with Nano Banana Pro",
  },
  {
    id: "ai-browser",
    Icon: Globe,
    title: "Turn your browser into an AI browser",
  },
];

interface ManusFeatureCardsProps {
  features?: FeatureCard[];
  className?: string;
}

export function ManusFeatureCards({
  features = defaultFeatures,
  className,
}: ManusFeatureCardsProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-4 max-w-4xl mx-auto", className)}>
      {features.map((feature) => {
        const IconComponent = feature.Icon;
        return (
          <button
            key={feature.id}
            onClick={feature.onClick}
            className="p-6 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-left bg-white"
          >
            <div className="mb-4">
              <IconComponent className="w-10 h-10 text-[#1D4E5F]" strokeWidth={1.25} />
            </div>
            <p className="text-sm text-[#1D4E5F] leading-relaxed">{feature.title}</p>
          </button>
        );
      })}
    </div>
  );
}

export default ManusFeatureCards;
