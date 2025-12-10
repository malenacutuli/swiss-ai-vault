import { Quote } from "lucide-react";
import { useTranslation } from "react-i18next";

export const SocialProofSection = () => {
  const { t } = useTranslation();

  const carouselItems = [
    t('home.socialProof.industries.swissBanks'),
    t('home.socialProof.industries.healthcare'),
    t('home.socialProof.industries.hnwi'),
    t('home.socialProof.industries.crypto'),
    t('home.socialProof.industries.blockchain'),
    t('home.socialProof.industries.insurance'),
    t('home.socialProof.industries.regtech'),
    t('home.socialProof.industries.wealthManagers'),
    t('home.socialProof.industries.privateBank'),
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 gradient-swiss opacity-20" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            {t('home.socialProof.title')}
          </h2>
        </div>

        {/* Infinite scrolling carousel */}
        <div className="relative mb-16">
          <div className="flex animate-scroll">
            {/* Double the items for seamless loop */}
            {[...carouselItems, ...carouselItems].map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                className="flex-shrink-0 px-8 py-3 mx-4 rounded-lg bg-muted/30 border border-border/30 text-sm font-medium text-muted-foreground whitespace-nowrap"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="max-w-3xl mx-auto">
          <div className="relative p-8 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
            <Quote className="absolute top-6 left-6 h-8 w-8 text-primary/20" />
            <blockquote className="text-lg sm:text-xl italic text-center mb-6 pt-4">
              "{t('home.socialProof.testimonial')}"
            </blockquote>
            <div className="text-center">
              <div className="font-semibold">{t('home.socialProof.author')}</div>
              <div className="text-sm text-muted-foreground">{t('home.socialProof.company')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
