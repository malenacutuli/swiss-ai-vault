import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const statsCards = [
  {
    title: "Total Projects",
    value: "12",
    icon: FolderKanban,
    change: "+2 this month",
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    title: "Total Datasets",
    value: "47,832",
    subtitle: "rows",
    icon: Database,
    change: "+5,234 this week",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    title: "Fine-tuned Models",
    value: "8",
    icon: Cpu,
    change: "+1 this week",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    title: "API Calls",
    value: "24.5K",
    subtitle: "this month",
    icon: Activity,
    change: "+12% from last month",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
];

const recentActivity = [
  {
    action: "Fine-tuning completed",
    target: "customer-support-v2",
    time: "2 hours ago",
    type: "success",
  },
  {
    action: "Dataset uploaded",
    target: "sales-faq-2024.jsonl",
    time: "5 hours ago",
    type: "info",
  },
  {
    action: "Evaluation started",
    target: "product-assistant model",
    time: "1 day ago",
    type: "warning",
  },
  {
    action: "New project created",
    target: "Legal Document Analyzer",
    time: "2 days ago",
    type: "info",
  },
  {
    action: "Model deployed",
    target: "sv-llama3-support-v1",
    time: "3 days ago",
    type: "success",
  },
];

const quickActions = [
  {
    title: "Create New Project",
    description: "Start a new AI fine-tuning project",
    icon: Plus,
    href: "/dashboard/projects/new",
    variant: "primary" as const,
  },
  {
    title: "Upload Dataset",
    description: "Add training data to your project",
    icon: Upload,
    href: "/dashboard/datasets/upload",
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
              Welcome back, <span className="text-primary">John</span>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.change}
                  </p>
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
                {recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-2 w-2 rounded-full",
                        activity.type === "success" && "bg-success",
                        activity.type === "info" && "bg-info",
                        activity.type === "warning" && "bg-warning"
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
                ))}
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
