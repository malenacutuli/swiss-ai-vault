import { useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { LabsSidebar } from "@/components/layout/LabsSidebar";
import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/projects": "Projects",
  "/dashboard/datasets": "Datasets",
  "/dashboard/finetuning": "Fine-tuning",
  "/dashboard/templates": "Templates",
  "/dashboard/evaluations": "Evaluations",
  "/dashboard/models": "Models",
  "/dashboard/catalog": "Catalog",
  "/dashboard/playground": "Playground",
  "/dashboard/traces": "Traces",
  "/dashboard/stats": "Usage Stats",
  "/dashboard/settings": "Settings",
  "/dashboard/admin/compliance": "Compliance",
};

function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  // Build breadcrumb items
  const breadcrumbs: { label: string; path: string }[] = [];
  let currentPath = '';
  
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label, path: currentPath });
  }

  // Only show breadcrumbs if we're deeper than dashboard root
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link 
        to="/dashboard" 
        className="hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
      </Link>
      {breadcrumbs.slice(1).map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4" />
          {index === breadcrumbs.length - 2 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link 
              to={crumb.path} 
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

export function LabsLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const showBreadcrumbs = location.pathname !== "/dashboard";

  return (
    <div className="flex min-h-screen bg-background">
      <LabsSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          collapsed ? "ml-16" : "ml-[280px]"
        )}
      >
        {/* Optional header with breadcrumbs */}
        {showBreadcrumbs && (
          <header className="h-14 border-b border-border flex items-center px-6 flex-shrink-0">
            <Breadcrumbs />
          </header>
        )}
        
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
