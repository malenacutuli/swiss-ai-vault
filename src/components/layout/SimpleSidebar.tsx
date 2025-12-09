import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Shield, Settings, Beaker, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";

interface SimpleSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
}

function SidebarLink({ to, icon: Icon, label, collapsed }: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
  );
}

export function SimpleSidebar({ collapsed, onToggle }: SimpleSidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Organization Switcher */}
      <div className={cn(
        "border-b border-sidebar-border",
        collapsed ? "p-2" : "p-4"
      )}>
        <OrganizationSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <SidebarLink 
          to="/vault-chat" 
          icon={MessageSquare} 
          label="Vault Chat" 
          collapsed={collapsed} 
        />
        <SidebarLink 
          to="/compliance" 
          icon={Shield} 
          label="Compliance" 
          collapsed={collapsed} 
        />
        <SidebarLink 
          to="/dashboard/settings" 
          icon={Settings} 
          label="Settings" 
          collapsed={collapsed} 
        />
      </nav>

      {/* Vault Labs Link */}
      <div className={cn(
        "border-t border-sidebar-border",
        collapsed ? "p-2" : "p-4"
      )}>
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground hover:text-sidebar-foreground transition-colors",
            collapsed && "justify-center"
          )}
        >
          <Beaker className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span>Open Vault Labs</span>
              <ArrowRight className="h-3 w-3" />
            </>
          )}
        </Link>
      </div>

      {/* Collapse Button */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 p-4 border-t border-sidebar-border",
          "text-muted-foreground hover:text-sidebar-foreground transition-colors",
          collapsed && "justify-center"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
