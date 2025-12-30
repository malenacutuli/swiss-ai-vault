import { Cloud } from "@/icons";
import { useTranslation } from "react-i18next";

import openaiLogo from "@/assets/models/openai-logo.png";
import anthropicLogo from "@/assets/models/anthropic-logo.png";
import googleLogo from "@/assets/models/google-logo.jpg";
import mistralLogo from "@/assets/models/mistral-logo.png";
import metaLogo from "@/assets/models/meta-logo.png";
import qwenLogo from "@/assets/models/qwen-logo.jpg";
import deepseekLogo from "@/assets/models/deepseek-logo.png";

const hybridModels = [
  { name: "GPT-4o", logo: openaiLogo },
  { name: "o1", logo: openaiLogo },
  { name: "Claude 3.5", logo: anthropicLogo },
  { name: "Gemini 2.0", logo: googleLogo },
];

const sovereignModels = [
  { name: "Llama 3.2", logo: metaLogo },
  { name: "Mistral", logo: mistralLogo },
  { name: "Qwen 2.5", logo: qwenLogo },
  { name: "Gemma 2", logo: googleLogo },
];

// All latest models for the marquee
const allLatestModels = [
  { name: "GPT-5", logo: openaiLogo },
  { name: "GPT-4o", logo: openaiLogo },
  { name: "o1 Pro", logo: openaiLogo },
  { name: "Claude 4.5 Opus", logo: anthropicLogo },
  { name: "Claude 4.5 Sonnet", logo: anthropicLogo },
  { name: "Gemini 3.0 Pro", logo: googleLogo },
  { name: "Gemini 2.0 Flash", logo: googleLogo },
  { name: "Llama 4", logo: metaLogo },
  { name: "Llama 3.3 70B", logo: metaLogo },
  { name: "Mistral Large 3", logo: mistralLogo },
  { name: "DeepSeek V3", logo: deepseekLogo },
  { name: "DeepSeek R1", logo: deepseekLogo },
  { name: "Qwen 3 72B", logo: qwenLogo },
  { name: "Gemma 2 27B", logo: googleLogo },
];

export const ModelsSection = () => {
  const { t } = useTranslation();

  return (
    <section id="models" className="py-24 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-normal tracking-[-0.045em] leading-[1.07] mb-4 text-foreground">
            {t('home.models.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('home.models.subtitle')}
          </p>
        </div>

        {/* Infinite scrolling marquee */}
        <div className="relative overflow-hidden mb-16">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
          
          <div className="flex animate-marquee">
            {[...allLatestModels, ...allLatestModels].map((model, index) => (
              <div
                key={`${model.name}-${index}`}
                className="flex items-center gap-2 px-4 py-2 mx-2 rounded-full bg-card border border-border/40 whitespace-nowrap flex-shrink-0"
              >
                <img src={model.logo} alt={model.name} className="w-5 h-5 rounded object-cover" />
                <span className="text-sm font-medium text-foreground">{model.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <div className="p-6 rounded-2xl bg-card border border-border/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-info" />
              </div>
              <h3 className="text-lg font-semibold">{t('home.models.hybridCloud.title')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('home.models.hybridCloud.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              {hybridModels.map((model) => (
                <div key={model.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/30">
                  <img src={model.logo} alt={model.name} className="w-4 h-4 rounded object-cover" />
                  <span className="text-xs font-medium">{model.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <img src="/favicon.svg" alt="Swiss Flag" className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{t('home.models.sovereignOpenSource.title')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('home.models.sovereignOpenSource.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              {sovereignModels.map((model) => (
                <div key={model.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <img src={model.logo} alt={model.name} className="w-4 h-4 rounded object-cover" />
                  <span className="text-xs font-medium">{model.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t('home.models.openaiCompatible')}</span>{" "}
              {t('home.models.openaiCompatibleDesc')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
