import { Button } from "@/components/ui/button";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <SwissFlag className="h-6 w-6" />
            <span className="text-xl font-bold">SwissVault<span className="text-primary">.ai</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.features')}
            </a>
            <a href="#models" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.models')}
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.pricing')}
            </a>
            <Link to="/docs/api" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.apiDocs')}
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">{t('nav.signIn')}</Link>
            </Button>
            <Button variant="swiss" size="sm" asChild>
              <Link to="/auth">{t('nav.getStarted')}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.features')}
              </a>
              <a href="#models" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.models')}
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.pricing')}
              </a>
              <Link to="/docs/api" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.apiDocs')}
              </Link>
              <div className="pt-2">
                <LanguageSwitcher />
              </div>
              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button variant="ghost" size="sm" className="flex-1" asChild>
                  <Link to="/auth">{t('nav.signIn')}</Link>
                </Button>
                <Button variant="swiss" size="sm" className="flex-1" asChild>
                  <Link to="/auth">{t('nav.getStarted')}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};