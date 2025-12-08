import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const codeExample = `from openai import OpenAI

client = OpenAI(
    api_key="sv_xxx",
    base_url="https://api.swissvault.ai/v1",
)

response = client.chat.completions.create(
    model="sv-llama3.2-8b-bank-assistant",
    messages=[{"role": "user", "content": "Explain this policy in plain language"}],
)`;

const features = [
  "OpenAI-compatible API – drop-in for existing code",
  "SDKs for Python and TypeScript with async and streaming",
  "Webhooks for evaluations, fine-tuning jobs and billing",
];

export const DeveloperSection = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-16 relative border-t border-border/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
          {/* Left: Content */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Loved by Developers and ML Teams
            </h2>
            <ul className="space-y-3 mb-6">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/docs/api">
              <Button variant="outline" className="gap-2">
                View API Docs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Right: Code */}
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">Python</span>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <pre className="p-4 text-xs overflow-x-auto">
              <code className="font-mono text-muted-foreground">
                {codeExample.split("\n").map((line, i) => (
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
          </div>
        </div>
      </div>
    </section>
  );
};
