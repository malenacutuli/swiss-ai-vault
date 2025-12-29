import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { Mail, MessageSquare, Building2, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const Contact = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(t("contact.successMessage"));
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            {t("contact.title")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("contact.subtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Contact Form */}
          <div className="p-8 rounded-xl bg-card border border-border/50">
            <h2 className="text-2xl font-bold mb-6">{t("contact.sendMessage")}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("contact.firstName")}</Label>
                  <Input id="firstName" placeholder="John" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("contact.lastName")}</Label>
                  <Input id="lastName" placeholder="Doe" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("contact.workEmail")}</Label>
                <Input id="email" type="email" placeholder="john@company.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">{t("contact.company")}</Label>
                <Input id="company" placeholder="Acme Inc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">{t("contact.message")}</Label>
                <Textarea 
                  id="message" 
                  placeholder={t("contact.messagePlaceholder")} 
                  rows={5}
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("contact.sending") : t("contact.sendButton")}
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="p-6 rounded-xl bg-card/50 border border-border/50">
              <Mail className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("contact.emailUs")}</h3>
              <p className="text-muted-foreground mb-2">{t("contact.emailUsDesc")}</p>
              <a href="mailto:hola@axessible.ai" className="text-primary hover:underline font-medium">
                hola@axessible.ai
              </a>
            </div>

            <div className="p-6 rounded-xl bg-card/50 border border-border/50">
              <MessageSquare className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("contact.enterpriseSales")}</h3>
              <p className="text-muted-foreground mb-2">{t("contact.enterpriseSalesDesc")}</p>
              <a href="mailto:hola@axessible.ai" className="text-primary hover:underline font-medium">
                hola@axessible.ai
              </a>
            </div>

            <div className="p-6 rounded-xl bg-card/50 border border-border/50">
              <Building2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("contact.headquarters")}</h3>
              <div className="text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <SwissFlag className="h-4 w-4" />
                  <span>Axessible Labs AG</span>
                </div>
                <p className="text-sm">Alte Landstrasse 28</p>
                <p className="text-sm">8802 Kilchberg, Zurich</p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-card/50 border border-border/50">
              <Clock className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("contact.responseTime")}</h3>
              <p className="text-muted-foreground">
                {t("contact.responseTimeDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
