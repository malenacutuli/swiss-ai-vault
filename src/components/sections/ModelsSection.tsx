import { Badge } from "@/components/ui/badge";

const models = [
  {
    name: "Llama 3.2 1B",
    params: "1B",
    vram: "4GB",
    methods: ["Full", "LoRA", "QLoRA"],
    popular: false,
  },
  {
    name: "Llama 3.2 3B",
    params: "3B",
    vram: "8GB",
    methods: ["LoRA", "QLoRA"],
    popular: true,
  },
  {
    name: "Mistral 7B",
    params: "7B",
    vram: "16GB",
    methods: ["LoRA", "QLoRA"],
    popular: true,
  },
  {
    name: "Qwen 2.5",
    params: "0.5-7B",
    vram: "2-16GB",
    methods: ["Full", "LoRA", "QLoRA"],
    popular: false,
  },
  {
    name: "Gemma 2",
    params: "2-9B",
    vram: "6-20GB",
    methods: ["LoRA", "QLoRA"],
    popular: false,
  },
];

const methodColors: Record<string, string> = {
  Full: "bg-success/20 text-success border-success/30",
  LoRA: "bg-info/20 text-info border-info/30",
  QLoRA: "bg-warning/20 text-warning border-warning/30",
};

export const ModelsSection = () => {
  return (
    <section id="models" className="py-24 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Supported Base Models
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose from the latest open-source language models, optimized for efficient fine-tuning
            with LoRA and QLoRA adapters.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/30 backdrop-blur-sm">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 border-b border-border/50 text-sm font-medium text-muted-foreground">
              <div>Model</div>
              <div>Parameters</div>
              <div>VRAM Required</div>
              <div>Methods</div>
            </div>

            {/* Rows */}
            {models.map((model, index) => (
              <div
                key={model.name}
                className={`grid grid-cols-4 gap-4 p-4 items-center hover:bg-accent/50 transition-colors ${
                  index !== models.length - 1 ? "border-b border-border/30" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  {model.popular && (
                    <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                      Popular
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground font-mono text-sm">{model.params}</div>
                <div className="text-muted-foreground font-mono text-sm">{model.vram}</div>
                <div className="flex flex-wrap gap-1.5">
                  {model.methods.map((method) => (
                    <span
                      key={method}
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${methodColors[method]}`}
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 justify-center mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${methodColors.Full}`}>Full</span>
              <span>All weights updated</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${methodColors.LoRA}`}>LoRA</span>
              <span>Low-Rank Adaptation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${methodColors.QLoRA}`}>QLoRA</span>
              <span>4-bit Quantized LoRA</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
