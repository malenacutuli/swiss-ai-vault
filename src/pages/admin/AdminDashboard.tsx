import { useState, useEffect } from "react";
import { 
  Users, 
  ListTodo, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Clock,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LucideIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  totalCreditsUsed: number;
  activeAgents: number;
}

interface RecentTask {
  id: string;
  prompt: string;
  status: string;
  created_at: string;
  user_id: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    totalCreditsUsed: 0,
    activeAgents: 0,
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskChartData, setTaskChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch user count
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Fetch task statistics
      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('id, status, created_at, credits_used');

      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const failedTasks = tasks?.filter(t => t.status === 'failed').length || 0;
      const pendingTasks = tasks?.filter(t => t.status === 'pending' || t.status === 'running').length || 0;
      const totalCredits = tasks?.reduce((sum, t) => sum + (t.credits_used || 0), 0) || 0;

      // Fetch recent tasks
      const { data: recent } = await supabase
        .from('agent_tasks')
        .select('id, prompt, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch active agents
      const { count: activeAgents } = await supabase
        .from('agent_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Generate chart data from tasks
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const chartData = last7Days.map(date => {
        const dayTasks = tasks?.filter(t => 
          t.created_at?.startsWith(date)
        ) || [];
        return {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          completed: dayTasks.filter(t => t.status === 'completed').length,
          failed: dayTasks.filter(t => t.status === 'failed').length,
          total: dayTasks.length,
        };
      });

      setStats({
        totalUsers: userCount || 0,
        activeUsers: Math.floor((userCount || 0) * 0.3), // Estimate
        totalTasks: tasks?.length || 0,
        completedTasks,
        failedTasks,
        pendingTasks,
        totalCreditsUsed: totalCredits,
        activeAgents: activeAgents || 0,
      });

      setRecentTasks(recent || []);
      setTaskChartData(chartData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors = {
    completed: '#10B981',
    failed: '#EF4444',
    pending: '#F59E0B',
    running: '#3B82F6',
  };

  const pieData = [
    { name: 'Completed', value: stats.completedTasks, color: '#10B981' },
    { name: 'Failed', value: stats.failedTasks, color: '#EF4444' },
    { name: 'Pending', value: stats.pendingTasks, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">System overview and metrics</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} strokeWidth={1.5} />
          Refresh
        </Button>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={stats.totalUsers}
          change={12}
          subtitle={`${stats.activeUsers} active`}
          icon={Users}
        />
        <MetricCard
          title="Total Tasks"
          value={stats.totalTasks}
          change={8}
          subtitle={`${stats.pendingTasks} pending`}
          icon={ListTodo}
        />
        <MetricCard
          title="Active Agents"
          value={stats.activeAgents}
          icon={Bot}
        />
        <MetricCard
          title="Credits Used"
          value={stats.totalCreditsUsed.toLocaleString()}
          change={-5}
          subtitle="This month"
          icon={DollarSign}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks Over Time */}
        <Card className="border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Tasks Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={taskChartData}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D4E5F" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1D4E5F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#1D4E5F"
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card className="border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">
              Task Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-500">
                  <Layers className="h-12 w-12 mx-auto mb-2 text-gray-300" strokeWidth={1.5} />
                  <p>No task data available</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card className="border-gray-200 bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium text-gray-900">
              Recent Tasks
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-[#1D4E5F]">
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 5).map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusIcon status={task.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.prompt.slice(0, 50)}...
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "ml-2",
                        task.status === 'completed' && "border-green-200 bg-green-50 text-green-700",
                        task.status === 'failed' && "border-red-200 bg-red-50 text-red-700",
                        task.status === 'pending' && "border-yellow-200 bg-yellow-50 text-yellow-700",
                        task.status === 'running' && "border-blue-200 bg-blue-50 text-blue-700"
                      )}
                    >
                      {task.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ListTodo className="h-12 w-12 mx-auto mb-2 text-gray-300" strokeWidth={1.5} />
                  <p>No recent tasks</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="border-gray-200 bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium text-gray-900">
              System Health
            </CardTitle>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              All Systems Operational
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <HealthItem name="API Gateway" status="healthy" latency="42ms" />
              <HealthItem name="Database" status="healthy" latency="12ms" />
              <HealthItem name="Agent Orchestrator" status="healthy" latency="85ms" />
              <HealthItem name="Sandbox Pool" status="healthy" latency="156ms" />
              <HealthItem name="AI Providers" status="healthy" latency="320ms" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  icon: LucideIcon;
}

function MetricCard({ title, value, change, subtitle, icon: Icon }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  
  return (
    <Card className="border-gray-200 bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <span className="text-sm text-gray-500">{title}</span>
          <div className="p-2 bg-[#1D4E5F]/10 rounded-lg">
            <Icon className="h-5 w-5 text-[#1D4E5F]" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-sm mt-2",
            isPositive && "text-green-600",
            isNegative && "text-red-600",
            !isPositive && !isNegative && "text-gray-500"
          )}>
            {isPositive && <TrendingUp className="h-4 w-4" strokeWidth={1.5} />}
            {isNegative && <TrendingDown className="h-4 w-4" strokeWidth={1.5} />}
            {Math.abs(change)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" strokeWidth={1.5} />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" strokeWidth={1.5} />;
    case 'running':
      return <Activity className="h-5 w-5 text-blue-500 animate-pulse" strokeWidth={1.5} />;
    default:
      return <Clock className="h-5 w-5 text-yellow-500" strokeWidth={1.5} />;
  }
}

function HealthItem({ name, status, latency }: { name: string; status: string; latency: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          status === 'healthy' && "bg-green-500",
          status === 'degraded' && "bg-yellow-500",
          status === 'down' && "bg-red-500"
        )} />
        <span className="text-sm text-gray-700">{name}</span>
      </div>
      <span className="text-sm text-gray-500">{latency}</span>
    </div>
  );
}
