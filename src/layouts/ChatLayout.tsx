import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SimpleSidebar } from "@/components/layout/SimpleSidebar";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <SimpleSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
