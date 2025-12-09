import { useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { LabsSidebar } from "@/components/layout/LabsSidebar";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/labs": "Vault Labs",
  "/labs/projects": "Projects",
  "/labs/datasets": "Datasets",
  "/labs/finetuning": "Fine-tuning",
  "/labs/templates": "Templates",
  "/labs/evaluations": "Evaluations",
  "/labs/models": "Models",
  "/labs/catalog": "Catalog",
  "/labs/playground": "Playground",
  "/labs/traces": "Traces",
  "/labs/stats": "Usage Stats",
  "/labs/settings": "Settings",
  "/labs/billing": "Billing",
  "/labs/notifications": "Notifications",
  "/labs/admin": "Admin",
  "/labs/admin/compliance": "Compliance",
  "/labs/admin/audit-logs": "Audit Logs",
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

  // Always show "Vault Labs" as first item
  if (breadcrumbs.length === 0 || breadcrumbs[0].path !== '/labs') {
    breadcrumbs.unshift({ label: 'Vault Labs', path: '/labs' });
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {index === breadcrumbs.length - 1 ? (
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
  const showBreadcrumbs = location.pathname !== "/labs";

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
