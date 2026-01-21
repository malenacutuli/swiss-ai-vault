import { cn } from "@/lib/utils";

interface FeatureCard {
  id: string;
  emoji: string;
  title: string;
  onClick?: () => void;
}

const defaultFeatures: FeatureCard[] = [
  {
    id: "download-app",
    emoji: "📱",
    title: "Download app to access SwissBrAIn anytime and anywhere",
  },
  {
    id: "nano-banana",
    emoji: "🍌",
    title: "Generate slides with Nano Banana Pro",
  },
  {
    id: "ai-browser",
    emoji: "💻",
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
      {features.map((feature) => (
        <button
          key={feature.id}
          onClick={feature.onClick}
          className="p-6 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-left bg-white"
        >
          <div className="text-4xl mb-4">{feature.emoji}</div>
          <p className="text-sm text-gray-700 leading-relaxed">{feature.title}</p>
        </button>
      ))}
    </div>
  );
}

export default ManusFeatureCards;
