import { useState, useEffect } from "react";
import { Download, Search, Filter, Eye, FileText, X } from "@/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Json } from "@/integrations/supabase/types";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  org_id: string | null;
  ip_address: string | null;
  details: Json | null;
  created_at: string | null;
}

interface Filters {
  action: string;
  resource: string;
  dateFrom: string;
  dateTo: string;
}

const PAGE_SIZE = 50;

const AuditLogs = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    action: "all",
    resource: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (filters.action !== "all") {
        query = query.eq("action", filters.action);
      }
      if (filters.resource !== "all") {
        query = query.eq("resource_type", filters.resource);
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters, page, user]);

  const clearFilters = () => {
    setFilters({
      action: "all",
      resource: "all",
      dateFrom: "",
      dateTo: "",
    });
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ["Timestamp", "Action", "Resource Type", "Resource ID", "User ID", "IP Address", "Details"];
    const csvContent = [
      headers.join(","),
      ...logs.map(log => [
        log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "",
        log.action,
        log.resource_type || "",
        log.resource_id || "",
        log.user_id || "",
        log.ip_address || "",
        log.details ? JSON.stringify(log.details).replace(/,/g, ";") : "",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const ActionBadge = ({ action }: { action: string }) => {
    const config: Record<string, { className: string; label: string }> = {
      INSERT: { className: "bg-success/20 text-success border-success/30", label: "Create" },
      UPDATE: { className: "bg-info/20 text-info border-info/30", label: "Update" },
      DELETE: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Delete" },
      ACCESS: { className: "bg-muted text-muted-foreground", label: "Access" },
    };
    const { className, label } = config[action] || { className: "bg-muted text-muted-foreground", label: action };
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const hasActiveFilters = filters.action !== "all" || filters.resource !== "all" || filters.dateFrom || filters.dateTo;

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
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Audit Logs
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Track all actions performed on the platform
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  
                  <Select
                    value={filters.action}
                    onValueChange={(v) => {
                      setFilters((f) => ({ ...f, action: v }));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="INSERT">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="ACCESS">Access</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.resource}
                    onValueChange={(v) => {
                      setFilters((f) => ({ ...f, resource: v }));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      <SelectItem value="datasets">Datasets</SelectItem>
                      <SelectItem value="finetuning_jobs">Jobs</SelectItem>
                      <SelectItem value="models">Models</SelectItem>
                      <SelectItem value="evaluations">Evaluations</SelectItem>
                      <SelectItem value="api_keys">API Keys</SelectItem>
                      <SelectItem value="projects">Projects</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    placeholder="From"
                    className="w-40"
                    value={filters.dateFrom}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                      setPage(1);
                    }}
                  />

                  <Input
                    type="date"
                    placeholder="To"
                    className="w-40"
                    value={filters.dateTo}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, dateTo: e.target.value }));
                      setPage(1);
                    }}
                  />

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="w-20">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-50" />
                          <p>No audit logs found</p>
                          {hasActiveFilters && (
                            <Button variant="link" size="sm" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {log.created_at
                            ? format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")
                            : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.user_id?.slice(0, 8) || "-"}
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={log.action} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.resource_type || "-"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.resource_id?.slice(0, 8) || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {log.ip_address || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {!loading && logs.length > 0 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(page * PAGE_SIZE, total)} of {total} logs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * PAGE_SIZE >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="font-mono text-sm">
                    {selectedLog.created_at
                      ? format(new Date(selectedLog.created_at), "PPpp")
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <div className="mt-1">
                    <ActionBadge action={selectedLog.action} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="font-mono text-sm">{selectedLog.user_id || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Organization ID</label>
                  <p className="font-mono text-sm">{selectedLog.org_id || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resource Type</label>
                  <p className="text-sm">{selectedLog.resource_type || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resource ID</label>
                  <p className="font-mono text-sm">{selectedLog.resource_id || "-"}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                  <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Details</label>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                  {selectedLog.details
                    ? JSON.stringify(selectedLog.details, null, 2)
                    : "No additional details"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;
