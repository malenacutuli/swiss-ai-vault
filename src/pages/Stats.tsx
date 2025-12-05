import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  useDailyUsageChart,
  useUsageSummary,
  SERVICE_COLORS,
} from "@/hooks/useCreditTransactions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

const Stats = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { dailyUsage, serviceTypes, isLoading: chartLoading } = useDailyUsageChart(30);
  const { summary, total, isLoading: summaryLoading } = useUsageSummary(30);

  const formatServiceName = (name: string) => {
    return name
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

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
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Page Header */}
              <div className="flex items-center gap-3">
                <BarChart3 className="h-7 w-7 text-primary" />
                <h1 className="text-2xl font-semibold text-foreground">
                  Usage Statistics
                </h1>
              </div>

              {/* Daily Credits Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    Daily Credits Usage (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : dailyUsage.length === 0 || serviceTypes.length === 0 ? (
                    <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No usage data available for the last 30 days</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={dailyUsage}>
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
                          tickFormatter={(value) => `${value}`}
                          label={{
                            value: "Credits Used",
                            angle: -90,
                            position: "insideLeft",
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 12,
                          }}
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
                            value.toFixed(2),
                            formatServiceName(name),
                          ]}
                        />
                        <Legend
                          formatter={(value) => formatServiceName(value)}
                          wrapperStyle={{ paddingTop: "20px" }}
                        />
                        {serviceTypes.map((service) => (
                          <Bar
                            key={service}
                            dataKey={service}
                            stackId="a"
                            fill={SERVICE_COLORS[service] || "hsl(var(--primary))"}
                            radius={[2, 2, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Usage Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    30-Day Usage Summary
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.map((item) => (
                          <TableRow key={item.service_type}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-3 w-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="font-medium">
                                  {formatServiceName(item.service_type)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.total_credits.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="border-t-2 border-border font-semibold">
                          <TableCell>
                            <span className="font-semibold">Total</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {total.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
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
