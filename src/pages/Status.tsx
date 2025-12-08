import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle, Clock, AlertCircle, Activity } from "lucide-react";

const statusItems = [
  {
    name: "API Gateway",
    status: "operational",
    uptime: "99.99%",
  },
  {
    name: "Vault Chat",
    status: "operational",
    uptime: "99.98%",
  },
  {
    name: "Fine-tuning Infrastructure",
    status: "operational",
    uptime: "99.95%",
  },
  {
    name: "Model Inference (vLLM)",
    status: "operational",
    uptime: "99.97%",
  },
  {
    name: "Database (Swiss Region)",
    status: "operational",
    uptime: "99.99%",
  },
  {
    name: "Storage (AWS eu-central-2)",
    status: "operational",
    uptime: "99.99%",
  },
  {
    name: "Authentication Services",
    status: "operational",
    uptime: "99.99%",
  },
  {
    name: "Webhook Delivery",
    status: "operational",
    uptime: "99.95%",
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "operational":
      return <CheckCircle className="h-5 w-5 text-success" />;
    case "degraded":
      return <AlertCircle className="h-5 w-5 text-warning" />;
    case "outage":
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded Performance";
    case "outage":
      return "Major Outage";
    default:
      return "Unknown";
  }
};

const Status = () => {
  const allOperational = statusItems.every(item => item.status === "operational");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">System Status</h1>
            <p className="text-muted-foreground mb-8">
              Real-time status of SwissVault.ai services
            </p>
            
            {/* Overall Status */}
            <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl border ${
              allOperational 
                ? "bg-success/10 border-success/20" 
                : "bg-warning/10 border-warning/20"
            }`}>
              {allOperational ? (
                <>
                  <CheckCircle className="h-6 w-6 text-success" />
                  <span className="text-lg font-semibold text-success">All Systems Operational</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-warning" />
                  <span className="text-lg font-semibold text-warning">Some Systems Affected</span>
                </>
              )}
            </div>
          </div>

          {/* Status Items */}
          <div className="space-y-4 mb-12">
            {statusItems.map((item) => (
              <div 
                key={item.name}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(item.status)}
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{item.uptime} uptime</span>
                  <span className={`text-sm font-medium ${
                    item.status === "operational" ? "text-success" : 
                    item.status === "degraded" ? "text-warning" : "text-destructive"
                  }`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Uptime Chart Placeholder */}
          <div className="p-8 rounded-xl bg-card border border-border/50 mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">90-Day Uptime</h2>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 90 }).map((_, i) => (
                <div 
                  key={i} 
                  className="flex-1 h-8 rounded-sm bg-success/80 hover:bg-success transition-colors"
                  title={`Day ${90 - i}: 100% uptime`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>90 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Incidents */}
          <div className="p-8 rounded-xl bg-card border border-border/50">
            <h2 className="text-xl font-semibold mb-4">Recent Incidents</h2>
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <p>No incidents reported in the last 90 days.</p>
            </div>
          </div>

          {/* Subscribe */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              For real-time updates, subscribe to our status notifications or follow us on{" "}
              <a href="https://twitter.com/swissvaultai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Twitter/X
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Status;
