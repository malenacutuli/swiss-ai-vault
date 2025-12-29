import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "@/icons";

const codeExamples = {
  inference: `from openai import OpenAI

client = OpenAI(
    api_key="sv_xxxxxxxx",
    base_url="https://api.swissvault.ai/v1"
)

response = client.chat.completions.create(
    model="sv-llama3.2-3b-abc12345",  # Your fine-tuned model
    messages=[{"role": "user", "content": "Hello!"}]
)`,
  finetune: `from swissvault import SwissVault

client = SwissVault(api_key="sv_xxxxxxxx")

# Upload and create snapshot
dataset = client.datasets.upload("data.jsonl", "My Dataset")
snapshot = client.datasets.create_snapshot(dataset.id, "v1.0")

# Start fine-tuning
job = client.fine_tuning.create(
    name="My Model",
    snapshot_id=snapshot.id,
    base_model="llama3.2-3b",
    method="qlora"
)
client.fine_tuning.start(job.id)`,
};

export const CodeSection = () => {
  const [activeTab, setActiveTab] = useState<"inference" | "finetune">("inference");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              OpenAI-Compatible API
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Drop-in replacement for OpenAI's API. Use your existing code and libraries 
              with zero changes—just point to SwissVault.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Works with OpenAI Python/JS SDKs
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Streaming responses supported
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Official Python SDK with async support
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Comprehensive type hints & docs
              </li>
            </ul>
            <div className="flex gap-3">
              <Button variant="swiss">
                View SDK Docs
              </Button>
              <Button variant="outline">
                API Reference
              </Button>
            </div>
          </div>

          {/* Right: Code */}
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border/50">
              <button
                onClick={() => setActiveTab("inference")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "inference"
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Inference
              </button>
              <button
                onClick={() => setActiveTab("finetune")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "finetune"
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Fine-Tuning
              </button>
            </div>

            {/* Code block */}
            <div className="relative">
              <pre className="p-4 text-sm overflow-x-auto">
                <code className="font-mono text-muted-foreground">
                  {codeExamples[activeTab].split("\n").map((line, i) => (
                    <div key={i} className="leading-relaxed">
                      {line.includes("from") || line.includes("import") ? (
                        <span className="text-info">{line}</span>
                      ) : line.includes("#") ? (
                        <span className="text-muted-foreground/60">{line}</span>
                      ) : line.includes('"') || line.includes("'") ? (
                        <span>
                          {line.split(/("[^"]*"|'[^']*')/).map((part, j) =>
                            part.startsWith('"') || part.startsWith("'") ? (
                              <span key={j} className="text-success">{part}</span>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </span>
                      ) : (
                        line
                      )}
                    </div>
                  ))}
                </code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
