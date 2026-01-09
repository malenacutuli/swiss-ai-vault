import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  ListTodo, 
  Bot, 
  Container,
  BarChart3, 
  Bell, 
  Shield, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface NavLinkProps {
  to: string;
  icon: LucideIcon;
  children: React.ReactNode;
  collapsed: boolean;
}

function NavLink({ to, icon: Icon, children, collapsed }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || 
    (to !== '/admin' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-[#1D4E5F]/10 text-[#1D4E5F] border-l-2 border-[#1D4E5F] -ml-[2px] pl-[14px]"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
      {!collapsed && <span>{children}</span>}
    </Link>
  );
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - LIGHT themed */}
      <aside 
        className={cn(
          "flex flex-col border-r border-gray-200 bg-white transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <Link to="/admin" className="flex items-center gap-2">
            <SwissFlag className="h-8 w-8" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-serif italic text-lg text-gray-900">
                  Swiss Br<span className="text-red-600">AI</span>n
                </span>
                <span className="text-xs text-gray-500 -mt-1">Admin Dashboard</span>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-gray-500 hover:text-gray-700"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          <NavLink to="/admin" icon={LayoutDashboard} collapsed={collapsed}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" icon={Users} collapsed={collapsed}>
            Users
          </NavLink>
          <NavLink to="/admin/tasks" icon={ListTodo} collapsed={collapsed}>
            Tasks
          </NavLink>
          <NavLink to="/admin/agents" icon={Bot} collapsed={collapsed}>
            Agents
          </NavLink>
          <NavLink to="/admin/sandboxes" icon={Container} collapsed={collapsed}>
            Sandboxes
          </NavLink>
          <NavLink to="/admin/metrics" icon={BarChart3} collapsed={collapsed}>
            Metrics
          </NavLink>
          <NavLink to="/admin/alerts" icon={Bell} collapsed={collapsed}>
            Alerts
          </NavLink>
          <NavLink to="/admin/audit-logs" icon={FileText} collapsed={collapsed}>
            Audit Logs
          </NavLink>
          <NavLink to="/admin/compliance" icon={Shield} collapsed={collapsed}>
            Compliance
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          <NavLink to="/admin/settings" icon={Settings} collapsed={collapsed}>
            Settings
          </NavLink>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium w-full transition-colors",
              "text-gray-600 hover:bg-red-50 hover:text-red-600",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
