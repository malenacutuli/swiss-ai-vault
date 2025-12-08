import { FileCheck, Code2, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DemoRequestModal } from "@/components/DemoRequestModal";

const solutions = [
  {
    icon: FileCheck,
    title: "Compliance & Policy Assistants",
    description: "Centralise internal policies, procedures and regulations.",
    features: [
      "Let employees ask questions in natural language with full audit logs",
      "Enforce zero-retention and strict model policies",
    ],
  },
  {
    icon: Code2,
    title: "Secure Developer & Ops Co-Pilots",
    description: "Connect to private GitHub repos, run code-aware models in a zero-trust environment.",
    features: [
      "Keep source code and credentials out of third-party logs",
    ],
  },
  {
    icon: Building2,
    title: "Knowledge Co-Pilots for Banking & Insurance",
    description: "Ingest product docs, KYC files, and internal wikis.",
    features: [
      "Provide frontline teams with instant, traceable answers",
      "RAG citations and evaluation dashboards",
    ],
  },
];

export const SolutionsSection = () => {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <section id="solutions" className="py-24 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built for Regulated Workflows
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              SwissVault is used to power internal assistants where privacy and explainability 
              matter more than raw experimentation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {solutions.map((solution) => (
              <div
                key={solution.title}
                className="group p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <solution.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{solution.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {solution.description}
                </p>
                <ul className="space-y-2">
                  {solution.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button variant="outline" className="gap-2" onClick={() => setDemoOpen(true)}>
              Explore all solutions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
