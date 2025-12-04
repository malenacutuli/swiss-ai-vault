import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, useRecentActivity, formatNumber } from "@/hooks/useDashboardStats";
import {
  FolderKanban,
  Database,
  Cpu,
  Activity,
  Plus,
  Upload,
  Eye,
  BookOpen,
  ArrowUpRight,
  Clock,
  AlertCircle,
} from "lucide-react";

const quickActions = [
  {
    title: "Create New Project",
    description: "Start a new AI fine-tuning project",
    icon: Plus,
    href: "/dashboard/projects",
    variant: "primary" as const,
  },
  {
    title: "Upload Dataset",
    description: "Add training data to your project",
    icon: Upload,
    href: "/dashboard/datasets",
    variant: "secondary" as const,
  },
  {
    title: "View Models",
    description: "Manage your fine-tuned models",
    icon: Eye,
    href: "/dashboard/models",
    variant: "secondary" as const,
  },
  {
    title: "API Documentation",
    description: "Learn how to integrate the API",
    icon: BookOpen,
    href: "/docs",
    variant: "secondary" as const,
  },
];

const Dashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { stats, loading: statsLoading } = useDashboardStats();
  const { activities, loading: activityLoading } = useRecentActivity();

  // Get user's first name for greeting
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Build stats cards with real data
  const statsCards = [
    {
      title: "Total Projects",
      value: formatNumber(stats.totalProjects),
      icon: FolderKanban,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Dataset Rows",
      value: formatNumber(stats.totalDatasetRows),
      subtitle: "total",
      icon: Database,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Fine-tuned Models",
      value: formatNumber(stats.totalModels),
      icon: Cpu,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "API Calls",
      value: formatNumber(stats.apiCallsThisMonth),
      subtitle: "this month",
      icon: Activity,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-[280px]"
        )}
      >
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        
        <main className="p-6 space-y-6">
          {/* Welcome message */}
          <div className="animate-fade-in">
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome back, <span className="text-primary">{firstName}</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your AI projects today.
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((stat, index) => (
              <Card
                key={stat.title}
                className="bg-card border-border animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={cn("rounded-lg p-2", stat.bgColor)}>
                    <stat.icon className={cn("h-4 w-4", stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </span>
                      {stat.subtitle && (
                        <span className="text-sm text-muted-foreground">
                          {stat.subtitle}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <Card className="bg-card border-border animate-fade-in animate-delay-300">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground">Recent Activity</CardTitle>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View all
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {activityLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                      <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))
                ) : activities.length === 0 ? (
                  // Empty state
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a project or upload a dataset to get started
                    </p>
                  </div>
                ) : (
                  // Activity list
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                    >
                      <div
                        className={cn(
                          "mt-0.5 h-2 w-2 rounded-full",
                          activity.type === "success" && "bg-success",
                          activity.type === "info" && "bg-info",
                          activity.type === "warning" && "bg-warning",
                          activity.type === "error" && "bg-destructive"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          {activity.action}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {activity.target}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-card border-border animate-fade-in animate-delay-400">
              <CardHeader>
                <CardTitle className="text-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.href}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-4 transition-colors",
                      action.variant === "primary"
                        ? "bg-primary/10 hover:bg-primary/20 border border-primary/20"
                        : "bg-secondary hover:bg-accent border border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        action.variant === "primary"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          action.variant === "primary"
                            ? "text-primary"
                            : "text-foreground"
                        )}
                      >
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
