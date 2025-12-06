import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  useDailyUsageChart,
  useUsageSummary,
  useCreditTransactions,
  SERVICE_COLORS,
} from "@/hooks/useCreditTransactions";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, Download, TrendingUp, Zap, Brain, Database } from "lucide-react";
import { format } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(160, 70%, 45%)",
  "hsl(45, 90%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(270, 70%, 60%)",
];

const Stats = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  
  const days = parseInt(timeRange);
  const { dailyUsage, serviceTypes, isLoading: chartLoading } = useDailyUsageChart(days);
  const { summary, total, isLoading: summaryLoading } = useUsageSummary(days);
  const { data: transactions } = useCreditTransactions(days);

  const formatServiceName = (name: string) => {
    return name
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getServiceIcon = (service: string) => {
    if (service.includes("FINE") || service.includes("LLM")) return <Brain className="h-4 w-4" />;
    if (service.includes("DATA") || service.includes("SYNTHETIC")) return <Database className="h-4 w-4" />;
    if (service.includes("EVAL")) return <TrendingUp className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  const exportCSV = () => {
    if (!transactions || transactions.length === 0) return;
    
    const headers = ["Date", "Service", "Credits Used", "Description"];
    const rows = transactions.map((t) => [
      format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss"),
      t.service_type,
      t.credits_used.toString(),
      t.description || "",
    ]);
    
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `usage-stats-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Prepare pie chart data
  const pieData = summary.map((item, index) => ({
    name: formatServiceName(item.service_type),
    value: item.total_credits,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Get individual service totals for cards
  const finetuningTotal = summary
    .filter((s) => s.service_type.includes("FINE") || s.service_type.includes("LLM"))
    .reduce((acc, s) => acc + s.total_credits, 0);
  
  const evaluationTotal = summary
    .filter((s) => s.service_type.includes("EVAL"))
    .reduce((acc, s) => acc + s.total_credits, 0);
  
  const dataGenTotal = summary
    .filter((s) => s.service_type.includes("DATA") || s.service_type.includes("SYNTHETIC") || s.service_type.includes("AUGMENT"))
    .reduce((acc, s) => acc + s.total_credits, 0);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <SidebarInset className="flex-1">
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-7 w-7 text-primary" />
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">
                      Usage Statistics
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Monitor your platform usage and costs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={exportCSV}
                    disabled={!transactions || transactions.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {summaryLoading ? (
                      <Skeleton className="h-9 w-24 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mt-2">
                        ${total.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Last {days} days
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Fine-tuning</p>
                      <Brain className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {summaryLoading ? (
                      <Skeleton className="h-9 w-24 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mt-2">
                        ${finetuningTotal.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Model training costs
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Evaluations</p>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {summaryLoading ? (
                      <Skeleton className="h-9 w-24 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mt-2">
                        ${evaluationTotal.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Model evaluation costs
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Data Generation</p>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {summaryLoading ? (
                      <Skeleton className="h-9 w-24 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mt-2">
                        ${dataGenTotal.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Synthetic data costs
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    Daily Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartLoading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : dailyUsage.length === 0 || serviceTypes.length === 0 ? (
                    <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No usage data available for the last {days} days</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={dailyUsage}>
                        <defs>
                          {serviceTypes.map((service, index) => (
                            <linearGradient
                              key={service}
                              id={`color${service}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={SERVICE_COLORS[service] || CHART_COLORS[index % CHART_COLORS.length]}
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor={SERVICE_COLORS[service] || CHART_COLORS[index % CHART_COLORS.length]}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--popover-foreground))",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number, name: string) => [
                            `$${value.toFixed(2)}`,
                            formatServiceName(name),
                          ]}
                        />
                        <Legend
                          formatter={(value) => formatServiceName(value)}
                          wrapperStyle={{ paddingTop: "20px" }}
                        />
                        {serviceTypes.map((service, index) => (
                          <Area
                            key={service}
                            type="monotone"
                            dataKey={service}
                            stackId="1"
                            stroke={SERVICE_COLORS[service] || CHART_COLORS[index % CHART_COLORS.length]}
                            fillOpacity={1}
                            fill={`url(#color${service})`}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Usage by Service & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">
                      Usage by Service
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summaryLoading ? (
                      <Skeleton className="h-[280px] w-full" />
                    ) : pieData.length === 0 ? (
                      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No usage data</p>
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={50}
                            label={({ name, percent }) =>
                              `${name} (${(percent * 100).toFixed(0)}%)`
                            }
                            labelLine={false}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              color: "hsl(var(--popover-foreground))",
                            }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, "Credits"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : !transactions || transactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No recent activity</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.slice(-10).reverse().map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">
                                {format(new Date(item.created_at), "MMM d, HH:mm")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1.5">
                                  {getServiceIcon(item.service_type)}
                                  {formatServiceName(item.service_type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                ${Number(item.credits_used).toFixed(4)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Usage Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    {days}-Day Usage Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : summary.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No usage data available
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">Total Credits</TableHead>
                          <TableHead className="text-right">% of Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.map((item, index) => (
                          <TableRow key={item.service_type}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-3 w-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <span className="font-medium">
                                  {formatServiceName(item.service_type)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${item.total_credits.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {total > 0 ? ((item.total_credits / total) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="border-t-2 border-border font-semibold bg-muted/50">
                          <TableCell>
                            <span className="font-semibold">Total</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ${total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            100%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Stats;