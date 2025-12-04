import { Link, useLocation } from "react-router-dom";
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
};

export const DashboardHeader = ({ sidebarCollapsed }: DashboardHeaderProps) => {
  const location = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

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
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover">
            <div className="p-3 border-b border-border">
              <p className="font-semibold text-foreground">Notifications</p>
            </div>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <p className="text-sm font-medium text-foreground">Fine-tuning completed</p>
              <p className="text-xs text-muted-foreground">Your model "customer-support-v2" is ready</p>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <p className="text-sm font-medium text-foreground">Dataset processed</p>
              <p className="text-xs text-muted-foreground">"Sales FAQ" dataset is ready for training</p>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <p className="text-sm font-medium text-foreground">API usage alert</p>
              <p className="text-xs text-muted-foreground">You've used 80% of your monthly quota</p>
            </DropdownMenuItem>
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
