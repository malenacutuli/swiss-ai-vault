import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Sparkles,
} from "@/icons";
import { SwissFlag } from "@/components/icons/SwissFlag";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFeatureAccess, FeatureAccess } from "@/hooks/useFeatureAccess";

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
  const { canAccess, isRestricted, accountType } = useFeatureAccess();

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
    navigate("/labs");
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const userName = user?.user_metadata?.full_name || t('common.user');
  const userEmail = user?.email || '';

  // Helper to conditionally render sidebar links
  const renderLink = (
    to: string,
    icon: React.ElementType,
    label: string,
    feature: keyof FeatureAccess
  ) => {
    if (!canAccess(feature)) return null;
    return (
      <SidebarLink
        key={to}
        to={to}
        icon={icon}
        label={label}
        collapsed={collapsed}
        isActive={isActive(to)}
      />
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-[280px]"
      )}
    >
      {/* Toggle button area */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border px-4 flex-shrink-0",
        collapsed ? "justify-center" : "justify-end"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Organization Switcher */}
      <div className={cn("px-3 py-2 flex-shrink-0", collapsed && "px-2")}>
        <OrganizationSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Restricted Access Banner */}
        {isRestricted && !collapsed && (
          <Alert className="mb-3 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              {accountType === 'vaultchat_only' ? 'Beta Access' : 
               accountType === 'beta_tester' ? 'Beta Tester' : 'Demo Access'}
              {' — Limited features'}
            </AlertDescription>
          </Alert>
        )}

        {/* Vault Chat - standalone at top */}
        {canAccess('vault_chat') && (
          <div className="mb-2">
            <SidebarLink 
              to="/chat" 
              icon={MessageSquare} 
              label="Vault Chat" 
              collapsed={collapsed}
              isActive={isActive("/chat")}
            />
          </div>
        )}

        {/* Data & Training - only show section if user has access to any feature */}
        {(canAccess('projects') || canAccess('datasets') || canAccess('fine_tuning') || canAccess('templates')) && (
          <>
            <SectionHeader label="Data & Training" collapsed={collapsed} />
            <div className="space-y-1">
              {renderLink("/labs/projects", FolderKanban, t('sidebar.projects'), 'projects')}
              {renderLink("/labs/datasets", Database, t('sidebar.datasets'), 'datasets')}
              {renderLink("/labs/finetuning", SlidersHorizontal, t('sidebar.finetuning'), 'fine_tuning')}
              {renderLink("/labs/templates", LayoutTemplate, t('sidebar.templates'), 'templates')}
            </div>
          </>
        )}

        {/* Inference - only show section if user has access to any feature */}
        {(canAccess('models') || canAccess('catalog') || canAccess('playground')) && (
          <>
            <SectionHeader label="Inference" collapsed={collapsed} />
            <div className="space-y-1">
              {renderLink("/labs/models", Cpu, t('sidebar.models'), 'models')}
              {renderLink("/labs/catalog", Library, t('sidebar.catalog'), 'catalog')}
              {renderLink("/labs/playground", Play, t('sidebar.playground'), 'playground')}
            </div>
          </>
        )}

        {/* Monitoring - only show section if user has access to any feature */}
        {(canAccess('evaluations') || canAccess('traces') || canAccess('usage_stats')) && (
          <>
            <SectionHeader label="Monitoring" collapsed={collapsed} />
            <div className="space-y-1">
              {renderLink("/labs/evaluations", BarChart3, t('sidebar.evaluations'), 'evaluations')}
              {renderLink("/labs/traces", Activity, t('sidebar.traces'), 'traces')}
              {renderLink("/labs/stats", TrendingUp, t('sidebar.stats'), 'usage_stats')}
            </div>
          </>
        )}

        {/* Settings - only show section if user has access to any feature */}
        {(canAccess('compliance') || canAccess('settings')) && (
          <>
            <SectionHeader label="Settings" collapsed={collapsed} />
            <div className="space-y-1">
              {renderLink("/labs/admin/compliance", Shield, t('sidebar.compliance'), 'compliance')}
              {renderLink("/labs/settings", Settings, t('sidebar.settings'), 'settings')}
            </div>
          </>
        )}
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
