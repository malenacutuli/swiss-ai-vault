import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SimpleSidebar } from "@/components/layout/SimpleSidebar";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { GhostModeToggle } from "@/components/ghost/GhostModeToggle";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Determine current mode from route
  const currentMode = location.pathname.includes("/ghost") ? "ghost" : "vault";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Header - only on small screens */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-3 flex items-center gap-2">
            <SwissFlag className="h-6 w-6 rounded" />
            <span className="font-semibold text-sidebar-foreground">
              SwissVault<span className="text-brand-accent">.ai</span>
            </span>
          </div>
        </div>
        <GhostModeToggle currentMode={currentMode} className="scale-90" />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <SwissFlag className="h-6 w-6 rounded" />
                <span className="font-semibold text-sidebar-foreground">
                  SwissVault<span className="text-brand-accent">.ai</span>
                </span>
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
      <div className="hidden md:block">
        <SimpleSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      
      {/* Main Content - no margin needed, sidebar is flex sibling */}
      <main className="flex-1 pt-14 md:pt-0 transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
