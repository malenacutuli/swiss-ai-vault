import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  FolderKanban,
  Database,
  SlidersHorizontal,
  BarChart3,
  Cpu,
  Library,
  Play,
  Lock,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  CreditCard,
  TrendingUp,
  Activity,
  Shield,
  LayoutTemplate,
} from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const DashboardSidebar = ({ collapsed, onToggle }: DashboardSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('sidebar.dashboard'), href: "/dashboard" },
    { icon: Lock, label: "Vault Chat", href: "/chat" },
    { icon: FolderKanban, label: t('sidebar.projects'), href: "/dashboard/projects" },
    { icon: Database, label: t('sidebar.datasets'), href: "/dashboard/datasets" },
    { icon: SlidersHorizontal, label: t('sidebar.finetuning'), href: "/dashboard/finetuning" },
    { icon: LayoutTemplate, label: t('sidebar.templates'), href: "/dashboard/templates" },
    { icon: BarChart3, label: t('sidebar.evaluations'), href: "/dashboard/evaluations" },
    { icon: Cpu, label: t('sidebar.models'), href: "/dashboard/models" },
    { icon: Library, label: t('sidebar.catalog'), href: "/dashboard/catalog" },
    { icon: Play, label: t('sidebar.playground'), href: "/dashboard/playground" },
    { icon: Activity, label: t('sidebar.traces'), href: "/dashboard/traces" },
    { icon: TrendingUp, label: t('sidebar.stats'), href: "/dashboard/stats" },
    { icon: Shield, label: t('sidebar.compliance'), href: "/dashboard/admin/compliance" },
    { icon: Settings, label: t('sidebar.settings'), href: "/dashboard/settings" },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: t('auth.signedOut'),
      description: t('auth.signedOutDescription'),
    });
    navigate("/");
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const userName = user?.user_metadata?.full_name || t('common.user');
  const userEmail = user?.email || '';

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-[280px]"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <a href="/" className="flex items-center gap-2">
            <SwissFlag className="h-8 w-8 rounded-lg" />
            {!collapsed && (
              <span className="text-lg font-semibold text-sidebar-foreground">
                SwissVault<span className="text-brand-accent">.ai</span>
              </span>
            )}
          </a>
        </div>

        {/* Organization Switcher */}
        <div className={cn("px-3 py-2", collapsed && "px-2")}>
          <OrganizationSwitcher collapsed={collapsed} />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Button */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "px-2"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('common.collapse')}
              </>
            )}
          </Button>
        </div>

        {/* User Profile */}
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent",
                  collapsed && "justify-center"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {userEmail}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/dashboard/settings">
                  <User className="mr-2 h-4 w-4" />
                  {t('common.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/dashboard/settings">
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('common.billing')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('sidebar.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('auth.logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
};