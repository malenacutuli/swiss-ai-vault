import { useTranslation } from 'react-i18next';
import swissVaultLogo from '@/assets/swissvault-logo-transparent.png';

// Inline Swiss flag SVG matching the favicon
const SwissFlagIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="32" height="32" rx="4" fill="#dc2626"/>
    <path d="M14 8H18V14H24V18H18V24H14V18H8V14H14V8Z" fill="white"/>
  </svg>
);

interface GhostTextViewProps {
  hasMessages: boolean;
  children?: React.ReactNode;
}

interface GhostTextViewEmptyProps {
  children?: React.ReactNode; // For the input box
}

export function GhostTextViewEmpty({ children }: GhostTextViewEmptyProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-[15vh] pb-8">
      {/* Logo and welcome text - positioned above input */}
      <div className="flex items-center justify-center mb-4">
        <img src={swissVaultLogo} alt="SwissVault" className="h-14 object-contain" />
      </div>
      <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-sans text-center mb-2">
        {t('ghost.welcome.title')}
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8 text-sm">
        {t('ghost.welcome.description')}
      </p>
      
      {/* Input box positioned here - Perplexity style */}
      <div className="w-full max-w-2xl">
        {children}
      </div>
      
      {/* Powered by text below input */}
      <div className="flex items-center gap-1.5 mt-6 text-xs text-muted-foreground/70">
        <SwissFlagIcon className="w-4 h-4" />
        <span>{t('ghost.welcome.poweredBy')}</span>
      </div>
      
      {/* AI disclaimer */}
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60 max-w-md">
        AI can make mistakes. Always check results. Swiss Vault does not use your information to train models.
      </p>
    </div>
  );
}

export function GhostTextView({ hasMessages, children }: GhostTextViewProps) {
  if (!hasMessages) {
    // Return null - we handle empty state separately to include input
    return null;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
