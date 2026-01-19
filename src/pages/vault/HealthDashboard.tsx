import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
  Plus,
  List,
  Calendar,
  ArrowRight,
  Activity,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SwissCard, SwissCardHeader, SwissCardTitle, SwissCardContent } from '@/components/ui/swiss/SwissCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  variant?: 'default' | 'warning' | 'success' | 'urgent';
}

function StatCard({ title, value, description, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'border-border',
    warning: 'border-amber-200 bg-amber-50/50',
    success: 'border-emerald-200 bg-emerald-50/50',
    urgent: 'border-red-200 bg-red-50/50'
  };

  const iconStyles = {
    default: 'text-[#1D4E5F]',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    urgent: 'text-red-600'
  };

  return (
    <SwissCard className={cn('transition-all hover:shadow-md', variantStyles[variant])} elevated>
      <SwissCardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1">
                <span className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg bg-white/80', iconStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </SwissCardContent>
    </SwissCard>
  );
}

interface Deadline {
  id: string;
  title: string;
  type: 'prior_auth' | 'appeal' | 'documentation' | 'review';
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  patientName?: string;
}

interface DashboardStats {
  pendingPAs: number;
  deniedClaims: number;
  urgentTasks: number;
  totalPriorAuths: number;
}

interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  priority: string;
  due_date?: string;
  status: string;
  prior_auth?: { reference_number: string; payer_name: string };
  claim?: { claim_number: string; payer_name: string };
  appeal?: { id: string; deadline: string };
}

function formatTimeRemaining(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (hours < 0) return 'Overdue';
  if (hours < 24) return `${hours}h remaining`;
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

function getPriorityStyles(priority: Deadline['priority']) {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'high':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'medium':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function HealthDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    pendingPAs: 0,
    deniedClaims: 0,
    urgentTasks: 0,
    totalPriorAuths: 0
  });
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats
      const { data: statsData, error: statsError } = await supabase.functions.invoke('healthcare-workflows', {
        body: { action: 'dashboard.stats' }
      });

      if (statsError) throw statsError;

      if (statsData?.stats) {
        setStats({
          pendingPAs: statsData.stats.pending_prior_auths || 0,
          deniedClaims: statsData.stats.denied_claims || 0,
          urgentTasks: statsData.stats.pending_tasks || 0,
          totalPriorAuths: statsData.stats.total_prior_auths || 0
        });
      }

      // Fetch pending tasks for deadlines
      const { data: tasksData, error: tasksError } = await supabase.functions.invoke('healthcare-workflows', {
        body: {
          action: 'tasks.list',
          filters: { status: 'pending', limit: 5 }
        }
      });

      if (tasksError) throw tasksError;

      if (tasksData?.tasks) {
        const mappedDeadlines: Deadline[] = tasksData.tasks.map((task: WorkflowTask) => ({
          id: task.id,
          title: task.title,
          type: mapTaskType(task.task_type),
          dueDate: task.due_date ? new Date(task.due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          priority: mapPriority(task.priority),
          patientName: task.prior_auth?.reference_number || task.claim?.claim_number || task.description
        }));
        setDeadlines(mappedDeadlines);
      }

    } catch (error) {
      console.error('Dashboard fetch error:', error);
      // Don't show error toast on initial load if user not authenticated
      if (!isLoading) {
        toast({
          title: 'Error loading dashboard',
          description: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const mapTaskType = (taskType: string): Deadline['type'] => {
    if (taskType.includes('prior_auth')) return 'prior_auth';
    if (taskType.includes('appeal')) return 'appeal';
    if (taskType.includes('documentation') || taskType.includes('document')) return 'documentation';
    return 'review';
  };

  const mapPriority = (priority: string): Deadline['priority'] => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'urgent';
      case 'high': return 'high';
      case 'normal': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const quickActions = [
    {
      label: 'New Prior Auth',
      icon: Plus,
      onClick: () => navigate('/vault/health'),
      description: 'Start a new prior authorization request'
    },
    {
      label: 'View Queue',
      icon: List,
      onClick: () => navigate('/vault/health'),
      description: 'Review pending authorizations'
    },
    {
      label: 'Appeals Dashboard',
      icon: AlertTriangle,
      onClick: () => navigate('/vault/health'),
      description: 'Manage denied claims and appeals'
    },
    {
      label: 'Schedule Review',
      icon: Calendar,
      onClick: () => navigate('/vault/health'),
      description: 'Plan documentation reviews'
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Activity className="w-8 h-8 text-[#1D4E5F] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-semibold italic text-foreground">
                Healthcare Operations
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Revenue cycle management dashboard
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button
                onClick={() => navigate('/vault/health')}
                className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90"
              >
                <Activity className="w-4 h-4 mr-2" />
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <section>
          <h2 className="font-serif text-lg font-medium italic text-foreground mb-4">
            Key Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Pending Prior Auths"
              value={stats.pendingPAs}
              description="Awaiting response"
              icon={FileCheck}
              variant={stats.pendingPAs > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Denied Claims"
              value={stats.deniedClaims}
              description="Require appeal"
              icon={AlertTriangle}
              variant={stats.deniedClaims > 0 ? 'urgent' : 'default'}
            />
            <StatCard
              title="Pending Tasks"
              value={stats.urgentTasks}
              description="Action required"
              icon={Clock}
              variant={stats.urgentTasks > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Total Prior Auths"
              value={stats.totalPriorAuths}
              description="All time"
              icon={TrendingUp}
              variant="success"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Deadlines */}
          <section className="lg:col-span-2">
            <SwissCard elevated>
              <SwissCardHeader>
                <div className="flex items-center justify-between">
                  <SwissCardTitle className="font-serif italic">
                    Upcoming Deadlines
                  </SwissCardTitle>
                  <Button variant="ghost" size="sm" className="text-[#1D4E5F]">
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </SwissCardHeader>
              <SwissCardContent>
                {deadlines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pending tasks</p>
                    <p className="text-xs mt-1">Tasks will appear here when created</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-white/50 hover:bg-white/80 transition-colors cursor-pointer"
                        onClick={() => navigate('/vault/health')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            deadline.priority === 'urgent' ? 'bg-red-500' :
                            deadline.priority === 'high' ? 'bg-amber-500' :
                            deadline.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                          )} />
                          <div>
                            <p className="text-sm font-medium">{deadline.title}</p>
                            <p className="text-xs text-muted-foreground">{deadline.patientName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-full border',
                            getPriorityStyles(deadline.priority)
                          )}>
                            {formatTimeRemaining(deadline.dueDate)}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SwissCardContent>
            </SwissCard>
          </section>

          {/* Quick Actions */}
          <section>
            <SwissCard elevated>
              <SwissCardHeader>
                <SwissCardTitle className="font-serif italic">
                  Quick Actions
                </SwissCardTitle>
              </SwissCardHeader>
              <SwissCardContent>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white/50 hover:bg-[#1D4E5F]/5 hover:border-[#1D4E5F]/20 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-[#1D4E5F]/10 text-[#1D4E5F] group-hover:bg-[#1D4E5F] group-hover:text-white transition-colors">
                        <action.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {action.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#1D4E5F] transition-colors" />
                    </button>
                  ))}
                </div>
              </SwissCardContent>
            </SwissCard>
          </section>
        </div>

        {/* Activity Summary */}
        <section>
          <SwissCard elevated>
            <SwissCardHeader>
              <SwissCardTitle className="font-serif italic">
                Weekly Activity Summary
              </SwissCardTitle>
            </SwissCardHeader>
            <SwissCardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-[#1D4E5F]/5">
                  <p className="text-2xl font-semibold text-[#1D4E5F]">24</p>
                  <p className="text-xs text-muted-foreground mt-1">PAs Submitted</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-emerald-50">
                  <p className="text-2xl font-semibold text-emerald-600">18</p>
                  <p className="text-xs text-muted-foreground mt-1">PAs Approved</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-50">
                  <p className="text-2xl font-semibold text-amber-600">5</p>
                  <p className="text-xs text-muted-foreground mt-1">Appeals Filed</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50">
                  <p className="text-2xl font-semibold text-blue-600">$127K</p>
                  <p className="text-xs text-muted-foreground mt-1">Revenue Recovered</p>
                </div>
              </div>
            </SwissCardContent>
          </SwissCard>
        </section>
      </main>
    </div>
  );
}
