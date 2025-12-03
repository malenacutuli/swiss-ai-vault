import { Shield, Lock, Server, FileCheck } from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";

const trustPoints = [
  {
    icon: Server,
    title: "Swiss Data Centers",
    description: "All infrastructure runs in AWS eu-central-2 (Zurich) and EU-hosted Supabase.",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES-256 encryption at rest, TLS 1.3 in transit. Your data is always protected.",
  },
  {
    icon: FileCheck,
    title: "GDPR Compliant",
    description: "Full compliance with GDPR and Swiss data protection regulations.",
  },
  {
    icon: Shield,
    title: "SOC 2 Type II",
    description: "Enterprise-grade security controls with regular third-party audits.",
  },
];

export const TrustSection = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 gradient-swiss opacity-40" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <SwissFlag className="h-8 w-8" />
              <span className="text-lg font-medium text-primary">Swiss Data Sovereignty</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Your Data Never Leaves Switzerland
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built from the ground up for organizations that require the highest standards 
              of data privacy and regulatory compliance.
            </p>
          </div>

          {/* Trust points grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {trustPoints.map((point) => (
              <div
                key={point.title}
                className="flex gap-4 p-6 rounded-2xl bg-card/30 border border-border/30 backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <point.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{point.title}</h3>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Certifications */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 items-center opacity-60">
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">GDPR</div>
              <div className="text-xs text-muted-foreground">Compliant</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">SOC 2</div>
              <div className="text-xs text-muted-foreground">Type II</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">ISO</div>
              <div className="text-xs text-muted-foreground">27001</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">FINMA</div>
              <div className="text-xs text-muted-foreground">Ready</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
