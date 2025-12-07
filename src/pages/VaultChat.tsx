import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { useState } from "react";
import { Lock } from "lucide-react";

const VaultChat = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-[280px]'}`}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        <main className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vault Chat</h1>
              <p className="text-muted-foreground">End-to-end encrypted conversations</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center h-[calc(100vh-200px)] border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">Chat interface coming soon...</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VaultChat;
