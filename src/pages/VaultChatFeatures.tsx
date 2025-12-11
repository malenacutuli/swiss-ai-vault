import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Lock, 
  Building2, 
  Heart, 
  Landmark, 
  Scale, 
  ShieldCheck,
  MessageSquareLock,
  FileSearch,
  Cpu,
  Flag,
  ClipboardCheck,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const industries = [
  {
    icon: Building2,
    title: "Public Institutions & Government",
    description: "Secure document processing and citizen services with full compliance"
  },
  {
    icon: Heart,
    title: "Healthcare & Life Sciences",
    description: "HIPAA-compliant AI for patient data and research documents"
  },
  {
    icon: Landmark,
    title: "Financial & Fintech Operators",
    description: "Bank-grade security for sensitive financial communications"
  },
  {
    icon: Scale,
    title: "Legal & Compliance Teams",
    description: "Privileged document analysis with attorney-client confidentiality"
  },
  {
    icon: ShieldCheck,
    title: "Defense & National Security",
    description: "Air-gapped deployment options for classified environments"
  }
];

const features = [
  {
    icon: MessageSquareLock,
    title: "End-to-End Encrypted Chat & Document Analysis",
    description: "AES-256-GCM encryption with keys that never leave your browser"
  },
  {
    icon: Cpu,
    title: "Model-Agnostic",
    description: "Use OpenAI, Claude, Gemini, or open-source LLMs - your choice"
  },
  {
    icon: Flag,
    title: "Swiss Sovereignty",
    description: "Zero U.S. cloud exposure with AWS eu-central-2 (Zurich) hosting"
  },
  {
    icon: ClipboardCheck,
    title: "Audit-Grade Logging & Role-Level Access Controls",
    description: "Complete audit trails with granular permission management"
  }
];

const VaultChatFeatures = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                Vault Chat
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-4 font-medium">
                Deploy AI behind <span className="text-primary">your</span> firewall — not theirs.
              </p>
              
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Adaptive assistants for mission-critical sectors, running with full end-to-end encryption, 
                Swiss data residency, and zero cloud leakage.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="text-base px-8 bg-gray-700/80 hover:bg-gray-800/90 text-white border-0 shadow-none">
                  <Link to="/auth">
                    Request Early Access
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-base px-8 border-gray-300 text-gray-700 hover:bg-gray-50">
                  <Link to="/contact">
                    Request Demo
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right: Video */}
            <div className="relative">
              <video 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-auto"
              >
                <source src="/videos/vault-chat-demo.mov" type="video/quicktime" />
                <source src="/videos/vault-chat-demo.mov" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Built For Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built for:
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Use AI to understand, extract, and act on your most sensitive data - 
              entirely within your perimeter. <strong>No logs. No leaks. No exceptions.</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((industry, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <industry.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {industry.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {industry.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Enterprise-Grade Security
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every layer designed for zero-trust environments
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex gap-4 p-6 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-gray-200 shadow-sm">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Your Data Never Leaves Your Control
              </h2>
              <p className="text-gray-600">
                SwissVault operates on a zero-knowledge principle
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Keys stored only in your browser",
                "Swiss data residency (AWS Zurich)",
                "No vendor access to plaintext",
                "SOC 2 Type II roadmap",
                "GDPR & Swiss DPA compliant",
                "On-premises deployment available"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild size="lg" className="px-8 bg-gray-700/80 hover:bg-gray-800/90 text-white border-0 shadow-none">
                <Link to="/auth">
                  Apply for Exclusive Access
                  <Lock className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VaultChatFeatures;
