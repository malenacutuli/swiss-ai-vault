import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Search, Bell, Sun, Moon, Sparkles } from "lucide-react";
import { useState } from "react";
import { useUnreadCount, useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow, parseISO } from "date-fns";

interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
}

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  datasets: "Datasets",
  finetuning: "Fine-tuning",
  evaluations: "Evaluations",
  models: "Models",
  playground: "Playground",
  settings: "Settings",
  notifications: "Notifications",
  catalog: "Model Catalog",
  stats: "Usage Statistics",
  traces: "Traces",
};

export const DashboardHeader = ({ sidebarCollapsed }: DashboardHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { data: unreadCount } = useUnreadCount();
  const { data: notifications } = useNotifications();

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => ({
    label: routeLabels[segment] || segment,
    href: "/" + pathSegments.slice(0, index + 1).join("/"),
    isLast: index === pathSegments.length - 1,
  }));

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  const recentNotifications = notifications?.slice(0, 5) || [];

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6"
    >
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={crumb.href}>
              {crumb.isLast ? (
                <BreadcrumbPage className="text-foreground font-medium">
                  {crumb.label}
                </BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9 bg-secondary border-border focus:ring-primary"
          />
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-foreground">Notifications</p>
              <button
                onClick={() => navigate("/dashboard/notifications")}
                className="text-xs text-primary hover:underline"
              >
                View all
              </button>
            </div>
            {recentNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  onClick={() => navigate("/dashboard/notifications")}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium text-foreground flex-1 truncate">
                      {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: false })}
                    </span>
                  </div>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {notification.message}
                    </p>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upgrade button */}
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Sparkles className="h-4 w-4" />
          Upgrade to Pro
        </Button>
      </div>
    </header>
  );
};
