import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

interface MarketingLayoutProps {
  children?: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing min-h-screen bg-background">
      <Navbar />
      <main>
        {children || <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

export default MarketingLayout;
