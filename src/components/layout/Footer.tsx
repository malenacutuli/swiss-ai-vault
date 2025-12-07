import { Link } from "react-router-dom";
import { SwissFlag } from "@/components/icons/SwissFlag";

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Documentation", href: "/docs/api" },
    { label: "API Reference", href: "/docs/api" },
    { label: "SDK", href: "/docs/api" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "#" },
    { label: "DPA", href: "#" },
    { label: "Security", href: "#" },
  ],
  Support: [
    { label: "Help Center", href: "#" },
    { label: "Status", href: "#" },
    { label: "Discord", href: "#" },
    { label: "GitHub", href: "#" },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <SwissFlag className="h-6 w-6" />
              <span className="text-lg font-bold">SwissVault<span className="text-primary">.ai</span></span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Enterprise AI fine-tuning with Swiss data residency.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              All systems operational
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-medium mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Axessible Labs AG. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <SwissFlag className="h-4 w-4" />
            Made in Switzerland
          </p>
        </div>
      </div>
    </footer>
  );
};
