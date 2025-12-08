import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { Mail, MessageSquare, Building2, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Message sent! We'll get back to you within 24 hours.");
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground">
              Have questions about SwissVault? Want to discuss enterprise deployment? 
              We'd love to hear from you.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Form */}
            <div className="p-8 rounded-xl bg-card border border-border/50">
              <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" type="email" placeholder="john@company.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" placeholder="Acme Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Tell us about your needs..." 
                    rows={5}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div className="p-6 rounded-xl bg-card/50 border border-border/50">
                <Mail className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Email Us</h3>
                <p className="text-muted-foreground mb-2">For general inquiries and support</p>
                <a href="mailto:hola@axessible.ai" className="text-primary hover:underline font-medium">
                  hola@axessible.ai
                </a>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border border-border/50">
                <MessageSquare className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Enterprise Sales</h3>
                <p className="text-muted-foreground mb-2">For enterprise deployment and custom solutions</p>
                <a href="mailto:malena@axessible.ai" className="text-primary hover:underline font-medium">
                  malena@axessible.ai
                </a>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border border-border/50">
                <Building2 className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Headquarters</h3>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SwissFlag className="h-4 w-4" />
                  <span>Axessible Labs AG, Switzerland</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border border-border/50">
                <Clock className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Response Time</h3>
                <p className="text-muted-foreground">
                  We typically respond within 24 hours during business days (CET).
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
