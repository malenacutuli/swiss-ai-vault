import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { WhySwissVaultSection } from "@/components/sections/WhySwissVaultSection";
import { SolutionsSection } from "@/components/sections/SolutionsSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { SecuritySection } from "@/components/sections/SecuritySection";
import { ModelsSection } from "@/components/sections/ModelsSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { SocialProofSection } from "@/components/sections/SocialProofSection";
import { DeveloperSection } from "@/components/sections/DeveloperSection";
import { SupportedBySection } from "@/components/sections/SupportedBySection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <WhySwissVaultSection />
        <SolutionsSection />
        <HowItWorksSection />
        <SecuritySection />
        <ModelsSection />
        <PricingSection />
        <SocialProofSection />
        <DeveloperSection />
        <SupportedBySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
