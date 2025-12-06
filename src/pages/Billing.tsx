import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, CreditCard, TrendingUp, Zap, Database, Brain, MessageSquare, CheckCircle } from "lucide-react";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useCreditTransactions } from "@/hooks/useCreditTransactions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const CREDIT_PACKAGES = [
  { amount: 10, popular: false },
  { amount: 25, popular: true },
  { amount: 50, popular: false },
  { amount: 100, popular: false },
];

const SERVICE_PRICING = [
  { service: "Fine-tuning", cost: "$0.01 per 1K tokens", icon: Brain },
  { service: "Evaluation", cost: "$0.005 per sample", icon: Zap },
  { service: "Synthetic Data", cost: "$0.002 per row", icon: Database },
  { service: "Inference", cost: "$0.001 per 1K tokens", icon: MessageSquare },
];

const Billing = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { credits, loading: creditsLoading } = useUserCredits();
  const { data: transactions, isLoading: txLoading } = useCreditTransactions();

  // Handle success/cancel from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const creditsAdded = searchParams.get("credits");

    if (success === "true" && creditsAdded) {
      toast.success(`Successfully added $${creditsAdded} in credits!`);
      navigate("/dashboard/billing", { replace: true });
    } else if (canceled === "true") {
      toast.info("Purchase canceled");
      navigate("/dashboard/billing", { replace: true });
    }
  }, [searchParams, navigate]);

  const handlePurchase = async (amount: number) => {
    setPurchasing(amount);
    try {
      const { data, error } = await supabase.functions.invoke("create-credits-checkout", {
        body: { amount },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      // Open Stripe checkout in new tab
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setPurchasing(null);
    }
  };

  // Prepare chart data from transactions
  const chartData = transactions
    ? transactions
        .slice(0, 30)
        .reduce((acc: { date: string; amount: number }[], tx) => {
          const date = format(new Date(tx.created_at), "MMM d");
          const existing = acc.find((d) => d.date === date);
          if (existing) {
            existing.amount += tx.credits_used;
          } else {
            acc.push({ date, amount: tx.credits_used });
          }
          return acc;
        }, [])
        .reverse()
    : [];

  return (
    <div className="min-h-screen bg-background flex w-full">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col">
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="flex-1 px-6 py-8 space-y-8">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Billing & Credits</h1>
              <p className="text-muted-foreground mt-1">Manage your credits and view usage</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Credits Balance */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Credit Balance
                </CardTitle>
                <CardDescription>Your available credits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {creditsLoading ? (
                  <Skeleton className="h-12 w-32" />
                ) : (
                  <div className="text-4xl font-bold text-primary font-mono">
                    ${credits?.toFixed(2) ?? "0.00"}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {CREDIT_PACKAGES.map((pkg) => (
                    <Button
                      key={pkg.amount}
                      variant={pkg.popular ? "default" : "outline"}
                      className={cn("relative", pkg.popular && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                      disabled={purchasing !== null}
                      onClick={() => handlePurchase(pkg.amount)}
                    >
                      {purchasing === pkg.amount ? "..." : `+$${pkg.amount}`}
                      {pkg.popular && (
                        <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
                          Popular
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Usage Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Usage This Month
                </CardTitle>
                <CardDescription>Daily credit consumption</CardDescription>
              </CardHeader>
              <CardContent>
                {txLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No usage data yet
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`$${value.toFixed(4)}`, "Credits Used"]}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pricing Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Service Pricing
              </CardTitle>
              <CardDescription>Cost per operation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SERVICE_PRICING.map((item) => (
                  <div
                    key={item.service}
                    className="p-4 rounded-lg border bg-secondary/30 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{item.service}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.cost}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Recent credit usage and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No transactions yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 20).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.credits_used > 0 ? "secondary" : "default"}>
                            {tx.credits_used > 0 ? "Usage" : "Purchase"}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {tx.service_type.toLowerCase().replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono",
                            tx.credits_used > 0 ? "text-foreground" : "text-green-500"
                          )}
                        >
                          {tx.credits_used > 0 ? "-" : "+"}${Math.abs(tx.credits_used).toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Billing;
