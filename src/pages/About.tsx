import { SwissFlag } from "@/components/icons/SwissFlag";
import { Shield, Lock, Database, Users, Award, Target } from "lucide-react";

const About = () => {
  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <SwissFlag className="h-4 w-4" />
            <span className="text-sm font-medium text-primary">About SwissVault</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Building the Future of{" "}
            <span className="text-gradient">Sovereign AI</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            SwissVault.ai is built by Axessible Labs AG, a Swiss AI research lab dedicated to 
            making enterprise AI secure, private, and compliant by design.
          </p>
        </div>

        {/* Mission */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground mb-4">
              We believe that organizations shouldn't have to choose between leveraging AI and 
              protecting their most sensitive data. SwissVault exists to prove that zero-trust 
              AI is not only possible but essential for the future of enterprise technology.
            </p>
            <p className="text-muted-foreground">
              By combining Swiss data sovereignty, end-to-end encryption, and full auditability, 
              we're setting a new standard for AI infrastructure in regulated industries.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <Shield className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Zero-Trust</h3>
              <p className="text-sm text-muted-foreground">Security by design, not afterthought</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <Lock className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">E2E Encrypted</h3>
              <p className="text-sm text-muted-foreground">Your data, your keys</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <Database className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Swiss Hosted</h3>
              <p className="text-sm text-muted-foreground">Data never leaves Switzerland</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <Target className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Audit-Ready</h3>
              <p className="text-sm text-muted-foreground">Full compliance transparency</p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-xl bg-card/50 border border-border/50">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
              <p className="text-muted-foreground">
                We build every feature with privacy as the foundation, not a feature to be added later.
              </p>
            </div>
            <div className="text-center p-8 rounded-xl bg-card/50 border border-border/50">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Customer Trust</h3>
              <p className="text-muted-foreground">
                Our customers trust us with their most sensitive data. We take that responsibility seriously.
              </p>
            </div>
            <div className="text-center p-8 rounded-xl bg-card/50 border border-border/50">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Excellence</h3>
              <p className="text-muted-foreground">
                We strive for excellence in every line of code, every security audit, and every customer interaction.
              </p>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="text-center p-8 rounded-xl bg-card border border-border/50 max-w-2xl mx-auto">
          <SwissFlag className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Axessible Labs AG</h3>
          <p className="text-muted-foreground mb-4">
            A Swiss AI research lab headquartered in Switzerland, focused on building 
            secure and sovereign AI infrastructure for regulated industries.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact: <a href="mailto:hola@axessible.ai" className="text-primary hover:underline">hola@axessible.ai</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
