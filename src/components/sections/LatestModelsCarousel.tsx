import { useTranslation } from "react-i18next";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import openaiLogo from "@/assets/models/openai-logo.png";
import anthropicLogo from "@/assets/models/anthropic-logo.png";
import googleLogo from "@/assets/models/google-logo.jpg";
import metaLogo from "@/assets/models/meta-logo.png";
import mistralLogo from "@/assets/models/mistral-logo.png";
import deepseekLogo from "@/assets/models/deepseek-logo.png";
import qwenLogo from "@/assets/models/qwen-logo.jpg";

interface ModelInfo {
  name: string;
  company: string;
  logo: string;
  releaseDate: string;
  contextLength: string;
  highlights: string[];
  badge?: string;
}

const latestModels: ModelInfo[] = [
  {
    name: "GPT-5",
    company: "OpenAI",
    logo: openaiLogo,
    releaseDate: "Dec 2025",
    contextLength: "256K",
    highlights: ["Multimodal reasoning", "Advanced agentic capabilities", "Native tool use"],
    badge: "New",
  },
  {
    name: "Claude 4.5 Opus",
    company: "Anthropic",
    logo: anthropicLogo,
    releaseDate: "Nov 2025",
    contextLength: "200K",
    highlights: ["Constitutional AI 2.0", "Extended thinking", "Superior coding"],
    badge: "New",
  },
  {
    name: "Gemini 3.0 Pro",
    company: "Google",
    logo: googleLogo,
    releaseDate: "Dec 2025",
    contextLength: "1M",
    highlights: ["Native multimodal", "Real-time search", "1M context window"],
    badge: "New",
  },
  {
    name: "o1 Pro",
    company: "OpenAI",
    logo: openaiLogo,
    releaseDate: "Dec 2025",
    contextLength: "128K",
    highlights: ["Chain-of-thought", "PhD-level reasoning", "Math & science"],
  },
  {
    name: "Llama 4",
    company: "Meta",
    logo: metaLogo,
    releaseDate: "Dec 2025",
    contextLength: "128K",
    highlights: ["Open weights", "Multimodal", "Efficient inference"],
    badge: "Open",
  },
  {
    name: "Mistral Large 3",
    company: "Mistral AI",
    logo: mistralLogo,
    releaseDate: "Nov 2025",
    contextLength: "128K",
    highlights: ["Multilingual", "Code generation", "EU sovereignty"],
  },
  {
    name: "DeepSeek V3",
    company: "DeepSeek",
    logo: deepseekLogo,
    releaseDate: "Dec 2025",
    contextLength: "128K",
    highlights: ["MoE architecture", "Cost-efficient", "Open source"],
    badge: "Open",
  },
  {
    name: "Qwen 3",
    company: "Alibaba",
    logo: qwenLogo,
    releaseDate: "Dec 2025",
    contextLength: "128K",
    highlights: ["72B parameters", "Multilingual", "Open weights"],
    badge: "Open",
  },
];

export const LatestModelsCarousel = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 relative bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            {t("home.latestModels.badge", "December 2025")}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-[-0.045em] leading-[1.07] mb-4 text-foreground">
            {t("home.latestModels.title", "Latest LLM Models")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("home.latestModels.subtitle", "Access the cutting-edge models from every leading AI lab – all through one unified API.")}
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-12">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {latestModels.map((model, index) => (
                <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                  <Card className="h-full bg-card border-border/60 hover:border-primary/30 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={model.logo}
                            alt={model.company}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div>
                            <h3 className="font-semibold text-foreground">{model.name}</h3>
                            <p className="text-xs text-muted-foreground">{model.company}</p>
                          </div>
                        </div>
                        {model.badge && (
                          <Badge 
                            variant={model.badge === "Open" ? "secondary" : "default"}
                            className="text-xs"
                          >
                            {model.badge}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                        <span>{model.releaseDate}</span>
                        <span className="text-primary font-medium">{model.contextLength} ctx</span>
                      </div>
                      
                      <ul className="space-y-1.5">
                        {model.highlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary mt-0.5">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-4" />
            <CarouselNext className="-right-4" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};
