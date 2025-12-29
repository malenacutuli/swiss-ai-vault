import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SimpleSidebar } from "@/components/layout/SimpleSidebar";
import { UnifiedHeader } from "@/components/layout/UnifiedHeader";
import { Button } from "@/components/ui/button";
import { X } from "@/icons";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Determine current mode from route
  const currentMode = location.pathname.includes("/ghost") ? "ghost" : "vault";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Unified Header - with logo */}
      <UnifiedHeader 
        product={currentMode as 'ghost' | 'vault'}
        onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMenuOpen={mobileMenuOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 top-14">
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
              <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
                <div className="flex items-center">
                  <SwissFlag className="h-8" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <SimpleSidebar 
                collapsed={false} 
                onToggle={() => {}} 
                onNavigate={() => setMobileMenuOpen(false)}
                hideHeader
              />
            </aside>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SimpleSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} hideHeader />
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
