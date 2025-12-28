import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SwissFlag } from "@/components/icons/SwissFlag";

const footerLinks = {
  products: [
    { labelKey: "footer.ghostChat", href: "/ghost" },
    { labelKey: "footer.vaultChat", href: "/features/vault-chat" },
    { labelKey: "footer.vaultLabs", href: "/features/vault-labs" },
    { labelKey: "footer.pricing", href: "/#pricing" },
    { labelKey: "footer.apiReference", href: "/docs/api" },
  ],
  company: [
    { labelKey: "footer.about", href: "/about" },
    { labelKey: "footer.contact", href: "/contact" },
  ],
  legal: [
    { labelKey: "footer.privacyPolicy", href: "/privacy-policy" },
    { labelKey: "footer.termsOfService", href: "/terms-of-service" },
    { labelKey: "footer.dpa", href: "/dpa" },
    { labelKey: "footer.security", href: "/#security" },
  ],
  support: [
    { labelKey: "footer.status", href: "/status" },
    { labelKey: "footer.emailSupport", href: "mailto:hola@axessible.ai" },
  ],
};

const categoryKeys: Record<string, string> = {
  products: "footer.products",
  company: "footer.company",
  legal: "footer.legal",
  support: "footer.support",
};

const HashLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => {
  const navigate = useNavigate();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const [path, hash] = href.split('#');
    const targetPath = path || '/';
    
    if (window.location.pathname !== targetPath) {
      navigate(targetPath);
      setTimeout(() => {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(hash);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

export const Footer = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="border-t border-border/50 bg-[hsl(222,47%,11%)]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <SwissFlag className="h-6 w-6" />
              <span className="text-lg font-bold text-white">SwissVault<span className="text-brand-accent">.ai</span></span>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {t('footer.allSystemsOperational')}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-medium mb-4 text-white">{t(categoryKeys[category])}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.labelKey}>
                    {link.href.includes('#') ? (
                      <HashLink
                        href={link.href}
                        className="text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {t(link.labelKey)}
                      </HashLink>
                    ) : link.href.startsWith('/') ? (
                      <Link
                        to={link.href}
                        className="text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {t(link.labelKey)}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {t(link.labelKey)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-300">
            © {new Date().getFullYear()} Axessible Labs AG. {t('footer.allRightsReserved')}
          </p>
          <p className="text-sm text-gray-300 flex items-center gap-2">
            <SwissFlag className="h-4 w-4" />
            {t('footer.madeInSwitzerland')}
          </p>
        </div>
      </div>
    </footer>
  );
};
