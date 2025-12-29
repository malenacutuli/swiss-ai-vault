import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode, useEffect } from "react";
import { useTheme } from "next-themes";

interface MarketingLayoutProps {
  children?: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (!stored && theme !== "light") setTheme("light");
  }, [theme, setTheme]);

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
