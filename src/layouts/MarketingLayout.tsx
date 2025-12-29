import { ReactNode } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

interface MarketingLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function MarketingLayout({ 
  children, 
  showNavbar = true, 
  showFooter = true 
}: MarketingLayoutProps) {
  return (
    <div className="marketing min-h-screen bg-background">
      {showNavbar && <Navbar />}
      <main>
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
