import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { WhySwissVaultSection } from "@/components/sections/WhySwissVaultSection";
import { SolutionsSection } from "@/components/sections/SolutionsSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ModelsSection } from "@/components/sections/ModelsSection";
import { LatestModelsCarousel } from "@/components/sections/LatestModelsCarousel";
import { PricingSection } from "@/components/sections/PricingSection";
import { SocialProofSection } from "@/components/sections/SocialProofSection";
import { DeveloperSection } from "@/components/sections/DeveloperSection";
import { SupportedBySection } from "@/components/sections/SupportedBySection";

const Index = () => {
  return (
    <>
      <HeroSection />
      <ModelsSection />
      <LatestModelsCarousel />
      <WhySwissVaultSection />
      <FeaturesSection />
      <SolutionsSection />
      <HowItWorksSection />
      <PricingSection />
      <SocialProofSection />
      <DeveloperSection />
      <SupportedBySection />
    </>
  );
};

export default Index;
