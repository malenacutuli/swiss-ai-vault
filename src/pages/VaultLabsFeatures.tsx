import { MarketingLayout } from "@/layouts/MarketingLayout";
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
      title: t("vaultLabsFeatures.datasets.title"),
      subtitle: t("vaultLabsFeatures.datasets.subtitle"),
      description: t("vaultLabsFeatures.datasets.description"),
      features: [
        { icon: FileText, text: t("vaultLabsFeatures.datasets.features.extract") },
        { icon: Trash2, text: t("vaultLabsFeatures.datasets.features.clean") },
        { icon: GitBranch, text: t("vaultLabsFeatures.datasets.features.version") },
        { icon: Lock, text: t("vaultLabsFeatures.datasets.features.encryption") },
      ],
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: "finetuning",
      icon: Sparkles,
      title: t("vaultLabsFeatures.finetuning.title"),
      subtitle: t("vaultLabsFeatures.finetuning.subtitle"),
      description: t("vaultLabsFeatures.finetuning.description"),
      features: [
        { icon: Cpu, text: t("vaultLabsFeatures.finetuning.features.methods") },
        { icon: Layers, text: t("vaultLabsFeatures.finetuning.features.models") },
        { icon: Target, text: t("vaultLabsFeatures.finetuning.features.alignment") },
        { icon: Shield, text: t("vaultLabsFeatures.finetuning.features.security") },
      ],
      gradient: "from-purple-500 to-pink-500",
    },
    {
      id: "evaluations",
      icon: BarChart3,
      title: t("vaultLabsFeatures.evaluations.title"),
      subtitle: t("vaultLabsFeatures.evaluations.subtitle"),
      description: t("vaultLabsFeatures.evaluations.description"),
      features: [
        { icon: Scale, text: t("vaultLabsFeatures.evaluations.features.judges") },
        { icon: BarChart3, text: t("vaultLabsFeatures.evaluations.features.compare") },
        { icon: Zap, text: t("vaultLabsFeatures.evaluations.features.byoe") },
        { icon: Eye, text: t("vaultLabsFeatures.evaluations.features.compliance") },
      ],
      gradient: "from-orange-500 to-red-500",
    },
    {
      id: "deployment",
      icon: Server,
      title: t("vaultLabsFeatures.deployment.title"),
      subtitle: t("vaultLabsFeatures.deployment.subtitle"),
      description: t("vaultLabsFeatures.deployment.description"),
      features: [
        { icon: Cpu, text: t("vaultLabsFeatures.deployment.features.gpu") },
        { icon: Cloud, text: t("vaultLabsFeatures.deployment.features.serverless") },
        { icon: HardDrive, text: t("vaultLabsFeatures.deployment.features.onprem") },
        { icon: Key, text: t("vaultLabsFeatures.deployment.features.inference") },
      ],
      gradient: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            {t("vaultLabsFeatures.hero.title")}{" "}
            {t("vaultLabsFeatures.hero.titleHighlight")}
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            {t("vaultLabsFeatures.hero.description")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth">{t("vaultLabsFeatures.hero.requestAccess")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">{t("vaultLabsFeatures.hero.scheduleDemo")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      {sections.map((section, index) => (
        <section 
          key={section.id} 
          className={`py-24 px-4 ${index % 2 === 1 ? 'bg-muted/50' : 'bg-background'}`}
        >
          <div className="container mx-auto max-w-6xl">
            <div className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              {/* Content */}
              <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${section.gradient} text-white text-sm font-medium mb-4`}>
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {section.subtitle}
                </h2>
                
                <p className="text-lg text-muted-foreground mb-8">
                  {section.description}
                </p>

                <ul className="space-y-4">
                  {section.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg bg-gradient-to-r ${section.gradient} text-white flex-shrink-0`}>
                        <feature.icon className="h-4 w-4" />
                      </div>
                      <span className="text-foreground">{feature.text}</span>
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
                ) : section.id === "finetuning" ? (
                  <video
                    src="/videos/verifiableprivacy.mov"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto bg-white"
                  />
                ) : section.id === "evaluations" ? (
                  <video
                    src="/videos/zerodataretention.mov"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto bg-white"
                  />
                ) : (
                  <video
                    src="/videos/switzerland.mov"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA Section */}
      <section className="py-24 px-4 bg-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-background mb-6">
            {t("vaultLabsFeatures.cta.title")}
          </h2>
          <p className="text-xl text-muted mb-10">
            {t("vaultLabsFeatures.cta.description")}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/auth">{t("vaultLabsFeatures.cta.requestAccess")}</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-muted text-background hover:bg-muted/20" asChild>
              <Link to="/contact">{t("vaultLabsFeatures.cta.talkToSales")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default VaultLabsFeatures;
