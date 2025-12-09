import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  Sparkles, 
  BarChart3, 
  Server,
  FileText,
  Trash2,
  GitBranch,
  Lock,
  Cpu,
  Layers,
  Shield,
  Zap,
  CheckCircle2,
  Target,
  Scale,
  Eye,
  Cloud,
  HardDrive,
  Key
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const VaultLabsFeatures = () => {
  const { t } = useTranslation();

  const sections = [
    {
      id: "datasets",
      icon: Database,
      title: "Datasets",
      subtitle: "Encrypted, Clean, and Production-Ready",
      description: "Prepare fine-tuning-ready datasets with precision tools for privacy-first environments. Every step is fully auditable and protected by end-to-end encryption.",
      features: [
        { icon: FileText, text: "Extract structured datasets from unstructured files and conversations" },
        { icon: Trash2, text: "Clean, deduplicate, and enrich with built-in transformers" },
        { icon: GitBranch, text: "Version, snapshot, and manage datasets securely across teams" },
        { icon: Lock, text: "Client-side encryption ensures no raw data ever leaves your perimeter" },
      ],
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: "finetuning",
      icon: Sparkles,
      title: "Fine-Tuning",
      subtitle: "Precision-Tuned Models, Privately Trained",
      description: "Train language models tailored to your domain - without compromising sovereignty. We select and optimize base models for you, applying state-of-the-art adaptation techniques securely.",
      features: [
        { icon: Cpu, text: "QLoRA, LoRA, and full fine-tuning on 40+ open models" },
        { icon: Layers, text: "Supports BYO base models or Swiss-hosted open weights" },
        { icon: Target, text: "Enforce alignment via DPO, GRPO, or your custom reward systems" },
        { icon: Shield, text: "Training data remains encrypted end-to-end throughout the process" },
      ],
      gradient: "from-purple-500 to-pink-500",
    },
    {
      id: "evaluations",
      icon: BarChart3,
      title: "Evaluations",
      subtitle: "Governed, Transparent, and Customizable",
      description: "Measure model performance with verifiable, reproducible, and explainable evaluations - even on encrypted deployments.",
      features: [
        { icon: Scale, text: "LLM-as-Judge evaluators (Claude, GPT, etc.) + classical metrics" },
        { icon: BarChart3, text: "Compare fine-tuned models vs. base + commercial APIs (Claude, GPT-4o)" },
        { icon: Zap, text: "Bring your own evaluator or connect any endpoint securely" },
        { icon: Eye, text: "Evaluate in zero-retention mode, preserving full compliance" },
      ],
      gradient: "from-orange-500 to-red-500",
    },
    {
      id: "deployment",
      icon: Server,
      title: "Deployment",
      subtitle: "Fully Isolated, Instantly Scalable",
      description: "Deploy fine-tuned models via a sovereign Swiss inference fabric, or run models entirely within your own stack - no tradeoffs on performance or privacy.",
      features: [
        { icon: Cpu, text: "Dedicated GPU endpoints with full isolation" },
        { icon: Cloud, text: "Serverless autoscaling across secure zones" },
        { icon: HardDrive, text: "Deploy inside your VPC, air-gapped data center, or on-prem" },
        { icon: Key, text: "Inference encrypted with client-held keys, not stored or logged" },
      ],
      gradient: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            The Complete AI Lifecycle,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Fully Sovereign
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            From raw data to production deployment - build, train, evaluate, and deploy AI models 
            with end-to-end encryption and Swiss data residency at every step.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gray-700/80 hover:bg-gray-800/90 text-white border-0 shadow-none" asChild>
              <Link to="/auth">Request Access</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50" asChild>
              <Link to="/contact">Schedule Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      {sections.map((section, index) => (
        <section 
          key={section.id} 
          className={`py-24 px-4 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
        >
          <div className="container mx-auto max-w-6xl">
            <div className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              {/* Content */}
              <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${section.gradient} text-white text-sm font-medium mb-4`}>
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {section.subtitle}
                </h2>
                
                <p className="text-lg text-gray-600 mb-8">
                  {section.description}
                </p>

                <ul className="space-y-4">
                  {section.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg bg-gradient-to-r ${section.gradient} text-white flex-shrink-0`}>
                        <feature.icon className="h-4 w-4" />
                      </div>
                      <span className="text-gray-700">{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className={`relative ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                {section.id === "datasets" ? (
                  <video
                    src="/videos/encryption.mov"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto bg-white"
                  />
                ) : (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-r ${section.gradient} opacity-10 rounded-3xl blur-3xl`} />
                    <div className="relative bg-white border border-gray-200 rounded-2xl p-8 shadow-xl">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${section.gradient} flex items-center justify-center mb-6`}>
                        <section.icon className="h-8 w-8 text-white" />
                      </div>
                      
                      <div className="space-y-4">
                        {section.features.map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <CheckCircle2 className={`h-5 w-5 text-transparent bg-gradient-to-r ${section.gradient} bg-clip-text`} style={{ color: i === 0 ? '#8B5CF6' : i === 1 ? '#EC4899' : i === 2 ? '#F97316' : '#10B981' }} />
                            <div className="h-3 bg-gray-100 rounded-full flex-1" style={{ width: `${85 - i * 10}%` }} />
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Encryption Status</span>
                          <span className="flex items-center gap-1.5 text-green-600 font-medium">
                            <Lock className="h-4 w-4" />
                            E2E Encrypted
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gray-900">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Build Sovereign AI?
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join organizations building AI on their most sensitive data - 
            with full control, full encryption, and zero compromises.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100" asChild>
              <Link to="/auth">Request Access</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800" asChild>
              <Link to="/contact">Talk to Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VaultLabsFeatures;
