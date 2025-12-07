import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const CTASection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            {t('landing.cta.title')}{" "}
            <span className="text-gradient">Swiss Precision?</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            {t('landing.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth">
                {t('landing.cta.button')}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" asChild>
              <a href="mailto:contact@swissvault.ai">
                {t('landing.cta.demo')}
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            {t('landing.cta.noCard')}
          </p>
        </div>
      </div>
    </section>
  );
};
