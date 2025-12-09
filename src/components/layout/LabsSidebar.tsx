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
  FolderKanban,
  Database,
  SlidersHorizontal,
  BarChart3,
  Cpu,
  Library,
  Play,
  MessageSquare,
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
  ArrowLeft,
} from "lucide-react";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface LabsSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  isActive: boolean;
}

function SidebarLink({ to, icon: Icon, label, collapsed, isActive }: SidebarLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  
  return (
    <div className="px-3 py-2 mt-4 first:mt-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function LabsSidebar({ collapsed, onToggle }: LabsSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isActive = (href: string) => {
    return location.pathname === href || 
      (href !== "/labs" && location.pathname.startsWith(href));
  };

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
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border px-4 flex-shrink-0",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <Link to="/labs" className="flex items-center gap-2">
          <SwissFlag className="h-8 w-8 rounded-lg" />
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">
              SwissVault<span className="text-brand-accent">.ai</span>
            </span>
          )}
        </Link>
      </div>

      {/* Organization Switcher */}
      <div className={cn("px-3 py-2 flex-shrink-0", collapsed && "px-2")}>
        <OrganizationSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Primary */}
        <SectionHeader label="Primary" collapsed={collapsed} />
        <SidebarLink 
          to="/chat" 
          icon={MessageSquare} 
          label="Vault Chat" 
          collapsed={collapsed}
          isActive={isActive("/chat")}
        />

        {/* Data & Training */}
        <SectionHeader label="Data & Training" collapsed={collapsed} />
        <div className="space-y-1">
          <SidebarLink 
            to="/labs/projects" 
            icon={FolderKanban} 
            label={t('sidebar.projects')} 
            collapsed={collapsed}
            isActive={isActive("/labs/projects")}
          />
          <SidebarLink 
            to="/labs/datasets" 
            icon={Database} 
            label={t('sidebar.datasets')} 
            collapsed={collapsed}
            isActive={isActive("/labs/datasets")}
          />
          <SidebarLink 
            to="/labs/finetuning" 
            icon={SlidersHorizontal} 
            label={t('sidebar.finetuning')} 
            collapsed={collapsed}
            isActive={isActive("/labs/finetuning")}
          />
          <SidebarLink 
            to="/labs/templates" 
            icon={LayoutTemplate} 
            label={t('sidebar.templates')} 
            collapsed={collapsed}
            isActive={isActive("/labs/templates")}
          />
        </div>

        {/* Inference */}
        <SectionHeader label="Inference" collapsed={collapsed} />
        <div className="space-y-1">
          <SidebarLink 
            to="/labs/models" 
            icon={Cpu} 
            label={t('sidebar.models')} 
            collapsed={collapsed}
            isActive={isActive("/labs/models")}
          />
          <SidebarLink 
            to="/labs/catalog" 
            icon={Library} 
            label={t('sidebar.catalog')} 
            collapsed={collapsed}
            isActive={isActive("/labs/catalog")}
          />
          <SidebarLink 
            to="/labs/playground" 
            icon={Play} 
            label={t('sidebar.playground')} 
            collapsed={collapsed}
            isActive={isActive("/labs/playground")}
          />
        </div>

        {/* Monitoring */}
        <SectionHeader label="Monitoring" collapsed={collapsed} />
        <div className="space-y-1">
          <SidebarLink 
            to="/labs/evaluations" 
            icon={BarChart3} 
            label={t('sidebar.evaluations')} 
            collapsed={collapsed}
            isActive={isActive("/labs/evaluations")}
          />
          <SidebarLink 
            to="/labs/traces" 
            icon={Activity} 
            label={t('sidebar.traces')} 
            collapsed={collapsed}
            isActive={isActive("/labs/traces")}
          />
          <SidebarLink 
            to="/labs/stats" 
            icon={TrendingUp} 
            label={t('sidebar.stats')} 
            collapsed={collapsed}
            isActive={isActive("/labs/stats")}
          />
        </div>

        {/* Settings */}
        <SectionHeader label="Settings" collapsed={collapsed} />
        <div className="space-y-1">
          <SidebarLink 
            to="/labs/admin/compliance" 
            icon={Shield} 
            label={t('sidebar.compliance')} 
            collapsed={collapsed}
            isActive={isActive("/labs/admin/compliance")}
          />
          <SidebarLink 
            to="/labs/settings" 
            icon={Settings} 
            label={t('sidebar.settings')} 
            collapsed={collapsed}
            isActive={isActive("/labs/settings")}
          />
        </div>
      </nav>

      {/* Simple Mode Link */}
      <div className={cn(
        "border-t border-sidebar-border px-3 py-3 flex-shrink-0",
        collapsed && "px-2"
      )}>
        <Link
          to="/chat"
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground hover:text-sidebar-foreground transition-colors",
            collapsed && "justify-center"
          )}
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Simple Mode</span>}
        </Link>
      </div>

      {/* Collapse Button */}
      <div className="border-t border-sidebar-border p-3 flex-shrink-0">
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
      <div className="border-t border-sidebar-border p-3 flex-shrink-0">
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
              <Link to="/labs/settings">
                <User className="mr-2 h-4 w-4" />
                {t('common.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/labs/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                {t('common.billing')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/labs/settings">
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
    </aside>
  );
}
