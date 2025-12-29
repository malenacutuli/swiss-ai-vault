import { Button } from "@/components/ui/button";
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

const VaultChatFeatures = () => {
  const { t } = useTranslation();

  const industries = [
    {
      icon: Building2,
      titleKey: "vaultChatFeatures.industries.government.title",
      descKey: "vaultChatFeatures.industries.government.description"
    },
    {
      icon: Heart,
      titleKey: "vaultChatFeatures.industries.healthcare.title",
      descKey: "vaultChatFeatures.industries.healthcare.description"
    },
    {
      icon: Landmark,
      titleKey: "vaultChatFeatures.industries.financial.title",
      descKey: "vaultChatFeatures.industries.financial.description"
    },
    {
      icon: Scale,
      titleKey: "vaultChatFeatures.industries.legal.title",
      descKey: "vaultChatFeatures.industries.legal.description"
    },
    {
      icon: ShieldCheck,
      titleKey: "vaultChatFeatures.industries.defense.title",
      descKey: "vaultChatFeatures.industries.defense.description"
    }
  ];

  const features = [
    {
      icon: MessageSquareLock,
      titleKey: "vaultChatFeatures.features.e2e.title",
      descKey: "vaultChatFeatures.features.e2e.description"
    },
    {
      icon: Cpu,
      titleKey: "vaultChatFeatures.features.modelAgnostic.title",
      descKey: "vaultChatFeatures.features.modelAgnostic.description"
    },
    {
      icon: Flag,
      titleKey: "vaultChatFeatures.features.sovereignty.title",
      descKey: "vaultChatFeatures.features.sovereignty.description"
    },
    {
      icon: ClipboardCheck,
      titleKey: "vaultChatFeatures.features.audit.title",
      descKey: "vaultChatFeatures.features.audit.description"
    }
  ];

  const trustItems = [
    "vaultChatFeatures.trust.items.keys",
    "vaultChatFeatures.trust.items.residency",
    "vaultChatFeatures.trust.items.noAccess",
    "vaultChatFeatures.trust.items.soc2",
    "vaultChatFeatures.trust.items.gdpr",
    "vaultChatFeatures.trust.items.onPremises"
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
                {t("vaultChatFeatures.hero.title")}
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-4 font-medium">
                {t("vaultChatFeatures.hero.subtitle")}
              </p>
              
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {t("vaultChatFeatures.hero.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="text-base px-8">
                  <Link to="/auth">
                    {t("vaultChatFeatures.hero.requestAccess")}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-base px-8">
                  <Link to="/contact">
                    {t("vaultChatFeatures.hero.requestDemo")}
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
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("vaultChatFeatures.builtFor.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("vaultChatFeatures.builtFor.description")} <strong>{t("vaultChatFeatures.builtFor.noLogs")}</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((industry, index) => (
              <div 
                key={index}
                className="bg-card rounded-xl p-6 border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <industry.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t(industry.titleKey)}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t(industry.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("vaultChatFeatures.features.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("vaultChatFeatures.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex gap-4 p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(feature.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card rounded-2xl p-8 md:p-12 border border-border shadow-sm">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {t("vaultChatFeatures.trust.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("vaultChatFeatures.trust.subtitle")}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {trustItems.map((itemKey, index) => (
                <div key={index} className="flex items-center gap-3 text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>{t(itemKey)}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild size="lg" className="px-8">
                <Link to="/auth">
                  {t("vaultChatFeatures.trust.cta")}
                  <Lock className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default VaultChatFeatures;
