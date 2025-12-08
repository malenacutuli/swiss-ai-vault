import { Shield, Lock, Server, ArrowRight } from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";

const pillars = [
  {
    icon: Lock,
    title: "Zero-Knowledge by Design",
    description: "We can't read your encrypted conversations – and neither can anyone else.",
    details: "Client-side AES-256-GCM, per-conversation keys, and strict row-level security.",
  },
  {
    icon: Server,
    title: "Swiss Data Residency & Governance",
    iconComponent: SwissFlag,
    description: "All data is stored in Swiss data centres with full audit trails and access controls.",
    details: "GDPR-ready today, SOC 2 / ISO 27001 / FINMA on the roadmap.",
  },
  {
    icon: Shield,
    title: "Full AI Lifecycle in One Secure Platform",
    description: "Ingest, fine-tune, evaluate and deploy assistants – using OpenAI, Anthropic, Gemini, or sovereign open-source models on Swiss GPUs.",
    details: "",
  },
];

export const WhySwissVaultSection = () => {
  return (
    <section id="why-swissvault" className="py-20 relative">
      <div className="absolute inset-0 gradient-swiss opacity-40" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why SwissVault?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enterprise AI infrastructure built for privacy-first organizations.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                {index === 1 ? (
                  <SwissFlag className="h-6 w-6" />
                ) : (
                  <pillar.icon className="h-6 w-6 text-primary" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">{pillar.title}</h3>
              <p className="text-muted-foreground text-sm mb-3">
                {pillar.description}
              </p>
              {pillar.details && (
                <p className="text-xs text-muted-foreground/70 border-t border-border/30 pt-3">
                  {pillar.details}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a 
            href="#security" 
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            See security architecture
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
};
