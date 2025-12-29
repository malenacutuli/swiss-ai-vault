import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Shield, Zap, Eye, Brain, Code, Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModelRow {
  name: string;
  inputPrice: string;
  outputPrice: string;
  capabilities: string[];
}

interface ModelSection {
  title: string;
  badge?: string;
  badgeVariant?: "swiss" | "pro";
  models: ModelRow[];
}

const CHAT_MODELS: ModelSection[] = [
  {
    title: "Swiss-Hosted (Private, Zero Logging)",
    badge: "Swiss-Hosted",
    badgeVariant: "swiss",
    models: [
      { name: "Qwen 2.5 3B", inputPrice: "$0.05", outputPrice: "$0.15", capabilities: ["Function Calling"] },
      { name: "Qwen 2.5 7B", inputPrice: "$0.10", outputPrice: "$0.30", capabilities: ["Function Calling"] },
      { name: "Mistral 7B", inputPrice: "$0.10", outputPrice: "$0.30", capabilities: ["Function Calling"] },
      { name: "Llama 3.3 70B", inputPrice: "$0.35", outputPrice: "$0.90", capabilities: ["Function Calling", "Reasoning"] },
      { name: "DeepSeek R1", inputPrice: "$0.55", outputPrice: "$2.19", capabilities: ["Reasoning", "Code"] },
    ],
  },
  {
    title: "Commercial (Anonymized)",
    badge: "Pro+ Required",
    badgeVariant: "pro",
    models: [
      { name: "GPT-4o Mini", inputPrice: "$0.15", outputPrice: "$0.60", capabilities: ["Vision"] },
      { name: "GPT-4o", inputPrice: "$2.50", outputPrice: "$10.00", capabilities: ["Vision", "Reasoning"] },
      { name: "GPT-4.5 Preview", inputPrice: "$75.00", outputPrice: "$150.00", capabilities: ["Vision", "Reasoning", "Code"] },
      { name: "Claude Sonnet 4", inputPrice: "$3.00", outputPrice: "$15.00", capabilities: ["Vision", "Reasoning", "Code"] },
      { name: "Claude Opus 4", inputPrice: "$15.00", outputPrice: "$75.00", capabilities: ["Vision", "Reasoning", "Code"] },
      { name: "Gemini 2.5 Pro", inputPrice: "$1.25", outputPrice: "$10.00", capabilities: ["Vision", "Reasoning"] },
    ],
  },
];

const IMAGE_MODELS: ModelSection[] = [
  {
    title: "Swiss-Hosted Image Generation",
    badge: "Swiss-Hosted",
    badgeVariant: "swiss",
    models: [
      { name: "FLUX.1 Schnell", inputPrice: "$0.003", outputPrice: "", capabilities: ["Fast"] },
      { name: "FLUX.1 Dev", inputPrice: "$0.025", outputPrice: "", capabilities: ["High Quality"] },
      { name: "Stable Diffusion 3.5", inputPrice: "$0.035", outputPrice: "", capabilities: ["High Quality"] },
    ],
  },
  {
    title: "Commercial Image Models",
    badge: "Pro+ Required",
    badgeVariant: "pro",
    models: [
      { name: "DALL-E 3 HD", inputPrice: "$0.080", outputPrice: "", capabilities: ["High Quality"] },
      { name: "Imagen 3", inputPrice: "$0.040", outputPrice: "", capabilities: ["High Quality"] },
      { name: "GPT-4o Image", inputPrice: "$0.040", outputPrice: "", capabilities: ["Vision"] },
    ],
  },
];

const VIDEO_MODELS: ModelSection[] = [
  {
    title: "Video Generation (per 5 seconds)",
    badge: "Pro+ Required",
    badgeVariant: "pro",
    models: [
      { name: "Runway Gen-3 Alpha", inputPrice: "$0.25", outputPrice: "", capabilities: ["720p"] },
      { name: "Kling 1.6 Pro", inputPrice: "$0.35", outputPrice: "", capabilities: ["1080p"] },
      { name: "Veo 2", inputPrice: "$0.50", outputPrice: "", capabilities: ["1080p", "High Quality"] },
    ],
  },
];

const ADDITIONAL_SERVICES = [
  { name: "Web Search", price: "$0.01/call", description: "Privacy-preserving search" },
  { name: "Web Scraping", price: "$0.01/call", description: "Extract content from URLs" },
  { name: "Text-to-Speech", price: "$3.50/1M chars", description: "Natural voice synthesis" },
  { name: "Speech-to-Text", price: "$0.36/hour", description: "Accurate transcription" },
  { name: "Document Parsing", price: "$0.01/page", description: "PDF, DOCX, images" },
  { name: "Embeddings", price: "$0.02/1M tokens", description: "Vector embeddings" },
];

const CapabilityBadge = ({ capability }: { capability: string }) => {
  const icons: Record<string, React.ReactNode> = {
    Vision: <Eye className="w-3 h-3" />,
    Reasoning: <Brain className="w-3 h-3" />,
    Code: <Code className="w-3 h-3" />,
    "Function Calling": <Zap className="w-3 h-3" />,
    Fast: <Zap className="w-3 h-3" />,
    "High Quality": <Shield className="w-3 h-3" />,
    "720p": null,
    "1080p": null,
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
      {icons[capability]}
      {capability}
    </span>
  );
};

const CollapsibleSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <h3 className="font-serif text-lg font-semibold">{title}</h3>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="border-t border-border/50">{children}</div>}
    </div>
  );
};

const ModelTable = ({ sections, showOutput = true }: { sections: ModelSection[]; showOutput?: boolean }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50 text-left">
            <th className="p-3 font-sans text-sm font-medium text-muted-foreground">Model</th>
            <th className="p-3 font-sans text-sm font-medium text-muted-foreground">
              {showOutput ? "Price (In / Out)" : "Price"}
            </th>
            <th className="p-3 font-sans text-sm font-medium text-muted-foreground">Capabilities</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, sectionIdx) => (
            <>
              <tr key={`section-${sectionIdx}`} className="bg-muted/30">
                <td colSpan={3} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-sm font-medium">{section.title}</span>
                    {section.badge && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          section.badgeVariant === "swiss" &&
                            "border-swiss-red/50 text-swiss-red bg-swiss-red/5",
                          section.badgeVariant === "pro" &&
                            "border-primary/50 text-primary bg-primary/5"
                        )}
                      >
                        {section.badgeVariant === "swiss" && <Lock className="w-3 h-3 mr-1" />}
                        {section.badge}
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
              {section.models.map((model, modelIdx) => (
                <tr
                  key={`${sectionIdx}-${modelIdx}`}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-3 font-sans text-sm">{model.name}</td>
                  <td className="p-3 font-mono text-sm">
                    {showOutput && model.outputPrice
                      ? `${model.inputPrice} / ${model.outputPrice}`
                      : model.inputPrice}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.map((cap) => (
                        <CapabilityBadge key={cap} capability={cap} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const APIPricing = () => {
  return (
    <>
      <Helmet>
        <title>API Pricing | SwissVault</title>
        <meta
          name="description"
          content="Transparent API pricing for SwissVault's privacy-first AI services. Swiss-hosted models with zero logging."
        />
      </Helmet>

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-16 md:py-24 border-b border-border/50">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center space-y-4">
              <Badge variant="outline" className="border-swiss-red/50 text-swiss-red">
                <Shield className="w-3 h-3 mr-1" />
                Privacy-First Pricing
              </Badge>
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">
                SwissVault API Pricing
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Transparent, usage-based pricing for privacy-preserving AI. Swiss-hosted models
                ensure your data never leaves Swiss jurisdiction.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
              <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="font-mono text-2xl font-bold text-primary">$0.05</div>
                <div className="text-sm text-muted-foreground">Starting price/1M tokens</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="font-mono text-2xl font-bold text-primary">$0.003</div>
                <div className="text-sm text-muted-foreground">Per image generation</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="font-mono text-2xl font-bold text-swiss-red">Zero</div>
                <div className="text-sm text-muted-foreground">Data logging</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="font-mono text-2xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Swiss-hosted</div>
              </div>
            </div>
          </div>
        </section>

        {/* Model Pricing Tables */}
        <section className="py-16">
          <div className="container max-w-5xl mx-auto px-4 space-y-8">
            <CollapsibleSection title="Chat Models (per 1M tokens)">
              <ModelTable sections={CHAT_MODELS} showOutput={true} />
            </CollapsibleSection>

            <CollapsibleSection title="Image Models (per generation)">
              <ModelTable sections={IMAGE_MODELS} showOutput={false} />
            </CollapsibleSection>

            <CollapsibleSection title="Video Models (per 5 seconds)">
              <ModelTable sections={VIDEO_MODELS} showOutput={false} />
              <div className="p-3 bg-muted/30 text-sm text-muted-foreground">
                <strong>Note:</strong> Video pricing scales linearly with duration. A 10-second video
                costs 2x the base price.
              </div>
            </CollapsibleSection>
          </div>
        </section>

        {/* Additional Services */}
        <section className="py-16 border-t border-border/50 bg-muted/20">
          <div className="container max-w-5xl mx-auto px-4">
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-center">
              Additional Services
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ADDITIONAL_SERVICES.map((service) => (
                <div
                  key={service.name}
                  className="p-4 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-sans font-medium">{service.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    </div>
                    <div className="font-mono text-sm text-primary font-medium">{service.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Payment Options */}
        <section className="py-16 border-t border-border/50">
          <div className="container max-w-5xl mx-auto px-4">
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-center">
              Payment Options
            </h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="p-6 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold">Credit Card</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Pay with Visa, Mastercard, or American Express. Secure payments via Stripe.
                </p>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Instant credit top-up</li>
                  <li>• Auto-reload available</li>
                  <li>• Invoice for business</li>
                </ul>
              </div>

              <div className="p-6 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold">Cryptocurrency</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Enhanced privacy with crypto payments. Bitcoin, Ethereum, and USDC accepted.
                </p>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• No personal info required</li>
                  <li>• 5% bonus on deposits</li>
                  <li>• Lightning Network supported</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Pro Subscriber Note */}
        <section className="py-16 border-t border-border/50 bg-primary/5">
          <div className="container max-w-3xl mx-auto px-4 text-center">
            <Badge className="mb-4 bg-primary text-primary-foreground">Pro Subscribers</Badge>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-4">
              Included with Pro Subscription
            </h2>
            <p className="text-muted-foreground mb-6">
              Pro subscribers ($20/month) receive monthly credits and exclusive access to commercial
              models. Credits never expire and roll over month-to-month.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="font-mono text-xl font-bold text-primary">$20</div>
                <div className="text-xs text-muted-foreground">Monthly credits</div>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="font-mono text-xl font-bold text-primary">15%</div>
                <div className="text-xs text-muted-foreground">Model discount</div>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="font-mono text-xl font-bold text-primary">∞</div>
                <div className="text-xs text-muted-foreground">Rollover</div>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button asChild variant="default" className="bg-primary hover:bg-primary/90">
                <Link to="/billing">Subscribe to Pro</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/api-docs">View API Docs</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default APIPricing;
