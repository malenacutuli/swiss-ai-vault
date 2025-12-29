import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ghost, Shield, Sun, Moon, Menu, X } from '@/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback } from 'react';

interface UnifiedHeaderProps {
  product: 'ghost' | 'vault';
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  showMobileMenu?: boolean;
}

export function UnifiedHeader({ 
  product, 
  onMenuToggle, 
  isMenuOpen,
  showMobileMenu = true 
}: UnifiedHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });
  
  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-40">
      {/* Left: Logo + Product Badge */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        {showMobileMenu && onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={onMenuToggle}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        )}

        {/* Logo */}
        <Link to="/" className="flex items-center">
          <SwissFlag className="h-10" />
        </Link>

        {/* Product Badge */}
        <Badge variant="outline" className="gap-1">
          {product === 'ghost' ? (
            <>
              <Ghost className="h-3.5 w-3.5" />
              Ghost
            </>
          ) : (
            <>
              <Shield className="h-3.5 w-3.5" />
              Vault
            </>
          )}
        </Badge>
      </div>

      {/* Right: Status + Controls */}
      <div className="flex items-center gap-2">
        {/* Zero Retention indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          <span>{t('ghost.status.zeroRetention', 'Zero Retention')}</span>
        </div>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Sign Up for non-authenticated users */}
        {user ? null : (
          <Button size="sm" onClick={() => navigate('/auth/ghost-signup')}>
            {t('ghost.auth.signUp', 'Sign Up')}
          </Button>
        )}
      </div>
    </header>
  );
}
