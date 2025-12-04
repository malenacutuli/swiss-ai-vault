import { useState } from "react";
import {
  Users,
  FolderOpen,
  Cpu,
  DollarSign,
  Database,
  Brain,
  Activity,
  Server,
  Search,
  MoreHorizontal,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Mock data
const mockStats = {
  users: { total: 1247, new: 89, growth_rate: 7.7 },
  projects: { total: 3456, active: 892 },
  datasets: { total: 5678, total_rows: 12500000 },
  finetuning: { total_jobs: 2341, active_jobs: 23, completed_this_period: 156 },
  models: { total: 1892, deployed: 456 },
  billing: { paying_customers: 312, conversion_rate: 25.0 },
};

const mockUserGrowth = [
  { date: "Mon", users: 1158 },
  { date: "Tue", users: 1175 },
  { date: "Wed", users: 1189 },
  { date: "Thu", users: 1205 },
  { date: "Fri", users: 1220 },
  { date: "Sat", users: 1235 },
  { date: "Sun", users: 1247 },
];

const mockJobsData = [
  { name: "Completed", value: 65, color: "hsl(var(--success))" },
  { name: "Training", value: 20, color: "hsl(var(--info))" },
  { name: "Failed", value: 10, color: "hsl(var(--destructive))" },
  { name: "Pending", value: 5, color: "hsl(var(--muted-foreground))" },
];

const mockUsers = [
  {
    id: "1",
    full_name: "John Smith",
    email: "john@company.com",
    tier: "enterprise",
    created_at: "2024-01-15",
    projects: 12,
    is_active: true,
  },
  {
    id: "2",
    full_name: "Sarah Chen",
    email: "sarah@startup.io",
    tier: "pro",
    created_at: "2024-02-20",
    projects: 8,
    is_active: true,
  },
  {
    id: "3",
    full_name: "Mike Johnson",
    email: "mike@tech.co",
    tier: "free",
    created_at: "2024-03-10",
    projects: 2,
    is_active: true,
  },
  {
    id: "4",
    full_name: "Emily Davis",
    email: "emily@research.edu",
    tier: "pro",
    created_at: "2024-03-25",
    projects: 5,
    is_active: false,
  },
];

const mockJobs = [
  {
    id: "job_abc123",
    name: "Customer Support Bot v2",
    user_email: "john@company.com",
    base_model: "Llama 3.2 3B",
    method: "LoRA",
    status: "training" as const,
    progress: 67,
    created_at: "2024-03-28T10:30:00Z",
  },
  {
    id: "job_def456",
    name: "Code Assistant Fine-tune",
    user_email: "sarah@startup.io",
    base_model: "Mistral 7B",
    method: "QLoRA",
    status: "queued" as const,
    progress: 0,
    created_at: "2024-03-28T11:15:00Z",
  },
  {
    id: "job_ghi789",
    name: "Legal Document Analyzer",
    user_email: "mike@tech.co",
    base_model: "Qwen 2.5 7B",
    method: "Full",
    status: "completed" as const,
    progress: 100,
    created_at: "2024-03-27T09:00:00Z",
  },
  {
    id: "job_jkl012",
    name: "Medical Q&A Model",
    user_email: "emily@research.edu",
    base_model: "Llama 3.2 1B",
    method: "LoRA",
    status: "failed" as const,
    progress: 45,
    created_at: "2024-03-26T14:20:00Z",
  },
];

const mockHealthComponents = {
  database: { status: "healthy", latency: "12ms" },
  redis: { status: "healthy", connected_clients: 45, used_memory: "256MB" },
  storage: { status: "healthy", available: "2.4TB" },
  celery: { status: "healthy", workers: ["worker-1", "worker-2", "worker-3"] },
  gpu_cluster: { status: "degraded", available_gpus: 6, total_gpus: 8 },
};

const Admin = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [period, setPeriod] = useState("7d");
  const [userSearch, setUserSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredJobs =
    jobStatusFilter === "all"
      ? mockJobs
      : mockJobs.filter((job) => job.status === jobStatusFilter);

  return (
    <div className="min-h-screen bg-background flex w-full">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col">
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Admin Dashboard
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Platform overview and management
                  </p>
                </div>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Users"
                value={mockStats.users.total}
                change={`+${mockStats.users.new} new`}
                icon={Users}
                trend={mockStats.users.growth_rate}
              />
              <StatCard
                title="Active Projects"
                value={mockStats.projects.active}
                subtitle={`of ${mockStats.projects.total} total`}
                icon={FolderOpen}
              />
              <StatCard
                title="Fine-tuning Jobs"
                value={mockStats.finetuning.completed_this_period}
                subtitle={`${mockStats.finetuning.active_jobs} active`}
                icon={Cpu}
              />
              <StatCard
                title="Paying Customers"
                value={mockStats.billing.paying_customers}
                change={`${mockStats.billing.conversion_rate}% conversion`}
                icon={DollarSign}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    User Growth
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={mockUserGrowth}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Jobs by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={mockJobsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {mockJobsData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Stats Tabs */}
            <Tabs defaultValue="users" className="space-y-4">
              <TabsList>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="jobs">Jobs</TabsTrigger>
                <TabsTrigger value="system">System Health</TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium">
                        User Management
                      </CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead>Projects</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">
                                  {user.full_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  user.tier === "enterprise" &&
                                    "bg-purple-500/20 text-purple-400",
                                  user.tier === "pro" &&
                                    "bg-info/20 text-info",
                                  user.tier === "free" &&
                                    "bg-muted text-muted-foreground"
                                )}
                              >
                                {user.tier}
                              </span>
                            </TableCell>
                            <TableCell>{user.projects}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  user.is_active
                                    ? "bg-success/20 text-success"
                                    : "bg-destructive/20 text-destructive"
                                )}
                              >
                                {user.is_active ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    Edit User
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">
                                    {user.is_active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="jobs">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium">
                        Job Management
                      </CardTitle>
                      <Select
                        value={jobStatusFilter}
                        onValueChange={setJobStatusFilter}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="queued">Queued</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">
                                  {job.name}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {job.id.slice(0, 12)}...
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {job.user_email}
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
                                {job.base_model}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{job.method}</span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={job.status} />
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>View Logs</DropdownMenuItem>
                                  {["queued", "training"].includes(
                                    job.status
                                  ) && (
                                    <DropdownMenuItem className="text-destructive">
                                      Cancel Job
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">System Components</h3>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(mockHealthComponents).map(
                      ([name, info]) => (
                        <Card key={name}>
                          <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full",
                                  info.status === "healthy" && "bg-success",
                                  info.status === "degraded" && "bg-warning",
                                  info.status === "unhealthy" && "bg-destructive"
                                )}
                              />
                              <div className="flex-1">
                                <p className="font-medium capitalize text-foreground">
                                  {name.replace("_", " ")}
                                </p>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {info.status}
                                </p>
                              </div>
                              {name === "database" && (
                                <span className="text-xs text-muted-foreground">
                                  {(info as any).latency}
                                </span>
                              )}
                              {name === "redis" && (
                                <span className="text-xs text-muted-foreground">
                                  {(info as any).used_memory}
                                </span>
                              )}
                              {name === "storage" && (
                                <span className="text-xs text-muted-foreground">
                                  {(info as any).available} free
                                </span>
                              )}
                              {name === "celery" && (
                                <span className="text-xs text-muted-foreground">
                                  {(info as any).workers?.length} workers
                                </span>
                              )}
                              {name === "gpu_cluster" && (
                                <span className="text-xs text-muted-foreground">
                                  {(info as any).available_gpus}/
                                  {(info as any).total_gpus} GPUs
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">
                        Admin Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm">
                          <Activity className="h-4 w-4 mr-2" />
                          View Logs
                        </Button>
                        <Button variant="outline" size="sm">
                          <Server className="h-4 w-4 mr-2" />
                          Cleanup Stale Jobs
                        </Button>
                        <Button variant="outline" size="sm">
                          <Database className="h-4 w-4 mr-2" />
                          Database Stats
                        </Button>
                        <Button variant="outline" size="sm">
                          <Brain className="h-4 w-4 mr-2" />
                          GPU Metrics
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  change?: string;
  icon: React.ElementType;
  trend?: number;
}

const StatCard = ({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  trend,
}: StatCardProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {value.toLocaleString()}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {change && (
              <p
                className={cn(
                  "text-xs",
                  trend && trend > 0 ? "text-success" : "text-muted-foreground"
                )}
              >
                {change}
              </p>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-full">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Admin;
