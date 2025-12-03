import { Database, Cpu, BarChart3, Lock, Zap, Code2 } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Dataset Management",
    description: "Upload, version, and manage training datasets with automatic validation and preprocessing.",
  },
  {
    icon: Cpu,
    title: "Fine-Tuning Pipeline",
    description: "Full fine-tuning, LoRA, and QLoRA methods with real-time progress tracking and checkpointing.",
  },
  {
    icon: BarChart3,
    title: "Model Evaluation",
    description: "Comprehensive evaluation metrics including perplexity, BLEU, and custom benchmarks.",
  },
  {
    icon: Lock,
    title: "Swiss Data Residency",
    description: "All data stored in AWS eu-central-2 (Zurich) with end-to-end encryption.",
  },
  {
    icon: Zap,
    title: "High-Performance Inference",
    description: "vLLM-powered inference API with OpenAI-compatible endpoints for seamless integration.",
  },
  {
    icon: Code2,
    title: "Developer SDK",
    description: "Official Python SDK with async support, streaming, and comprehensive type hints.",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 gradient-swiss opacity-50" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need for AI Fine-Tuning
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete platform for training, evaluating, and deploying custom language models
            with enterprise-grade security and Swiss data compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
