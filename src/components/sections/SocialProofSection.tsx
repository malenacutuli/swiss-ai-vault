import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "SwissVault let us roll out internal AI assistants without sending any client data to US clouds – that was non-negotiable.",
    author: "CISO",
    company: "Swiss Financial Institution",
  },
];

const logos = [
  { name: "Swiss Bank", placeholder: true },
  { name: "European Insurer", placeholder: true },
  { name: "RegTech Vendor", placeholder: true },
  { name: "Wealth Manager", placeholder: true },
  { name: "Private Bank", placeholder: true },
];

export const SocialProofSection = () => {
  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 gradient-swiss opacity-20" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Trusted by Security-First Teams
          </h2>
        </div>

        {/* Logo row */}
        <div className="flex flex-wrap justify-center gap-8 mb-16 opacity-60">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="px-6 py-3 rounded-lg bg-muted/30 border border-border/30 text-sm font-medium text-muted-foreground"
            >
              {logo.name}
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="max-w-3xl mx-auto">
          {testimonials.map((testimonial, idx) => (
            <div
              key={idx}
              className="relative p-8 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm"
            >
              <Quote className="absolute top-6 left-6 h-8 w-8 text-primary/20" />
              <blockquote className="text-lg sm:text-xl italic text-center mb-6 pt-4">
                "{testimonial.quote}"
              </blockquote>
              <div className="text-center">
                <div className="font-semibold">{testimonial.author}</div>
                <div className="text-sm text-muted-foreground">{testimonial.company}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
