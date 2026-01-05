import { Button } from "@/components/ui/button";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { SwissAgentsIcon } from "@/components/icons/SwissAgentsIcon";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <SwissFlag className="h-14" />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.products')}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/ghost">Ghost Chat</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/features/vault-chat">
                      Vault Chat
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/features/vault-labs">
                      Vault Labs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/ghost/agents" className="flex items-center gap-2">
                      <SwissAgentsIcon className="h-4 w-4" />
                      Swiss Agents
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">New</Badge>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <a href="/#models" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.models')}
              </a>
              <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
              <Button variant="swiss" size="sm" onClick={() => setEarlyAccessOpen(true)}>
                {t('nav.earlyAccess', 'Apply')}
                <ArrowRight className="h-4 w-4 ml-1" />
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
                <Link to="/ghost" className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>
                  Ghost Chat
                </Link>
                <Link to="/features/vault-chat" className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>
                  Vault Chat
                </Link>
                <Link to="/features/vault-labs" className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>
                  Vault Labs
                </Link>
                <Link to="/ghost/agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" onClick={() => setIsOpen(false)}>
                  <SwissAgentsIcon className="h-4 w-4" />
                  Swiss Agents
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">New</Badge>
                </Link>
                <a href="/#models" className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>
                  {t('nav.models')}
                </a>
                <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>
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
                  <Button variant="swiss" size="sm" className="flex-1" onClick={() => setEarlyAccessOpen(true)}>
                    {t('nav.earlyAccess', 'Apply')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <EarlyAccessModal open={earlyAccessOpen} onOpenChange={setEarlyAccessOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
