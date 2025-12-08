import { Cloud } from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";

import openaiLogo from "@/assets/models/openai-logo.png";
import anthropicLogo from "@/assets/models/anthropic-logo.png";
import googleLogo from "@/assets/models/google-logo.jpg";
import mistralLogo from "@/assets/models/mistral-logo.png";
import metaLogo from "@/assets/models/meta-logo.png";
import qwenLogo from "@/assets/models/qwen-logo.jpg";

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

export const ModelsSection = () => {
  return (
    <section id="models" className="py-24 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Use the Best Models – Without Losing Sovereignty
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            SwissVault abstracts away providers so you can choose the right model for each workload 
            while keeping governance and logging in one place.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-info" />
              </div>
              <h3 className="text-lg font-semibold">Hybrid Cloud</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              GPT-4o, o1, Claude 3.5, Gemini 2.0 for workloads allowed to use US APIs. 
              Centralised routing, billing and monitoring.
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

          <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <SwissFlag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">Sovereign Open-Source</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Llama, Mistral, Qwen, Gemma and more, hosted on Swiss GPUs via vLLM. 
              Option to restrict an organisation to Swiss-hosted open-source models only.
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
              <span className="font-medium text-foreground">Already using OpenAI?</span>{" "}
              Drop-in compatible with the OpenAI Python and JS SDKs – just change the base URL.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
