import { useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Shield,
  User,
  Database,
  Key,
  Settings,
  AlertTriangle
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  metadata: any;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
  'auth': User,
  'user': User,
  'database': Database,
  'api_key': Key,
  'settings': Settings,
  'security': Shield,
  'default': FileText,
};

const SEVERITY_COLORS: Record<string, string> = {
  'critical': 'border-red-200 bg-red-50 text-red-700',
  'warning': 'border-yellow-200 bg-yellow-50 text-yellow-700',
  'info': 'border-blue-200 bg-blue-50 text-blue-700',
  'success': 'border-green-200 bg-green-50 text-green-700',
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7d");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const { toast } = useToast();
  
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter, dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalLogs(count || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.resource_type?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (log.user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesSearch;
  });

  const handleExportFINMA = () => {
    // FINMA-compliant export format
    const exportData = {
      export_timestamp: new Date().toISOString(),
      export_type: 'FINMA_AUDIT_LOG',
      date_range: {
        start: getDateFilter(),
        end: new Date().toISOString(),
      },
      total_records: filteredLogs.length,
      logs: filteredLogs.map(log => ({
        timestamp: log.created_at,
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        user_id: log.user_id,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        details: log.details,
        metadata: log.metadata,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finma-audit-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    toast({
      title: "Export Complete",
      description: "FINMA-compliant audit log exported successfully",
    });
  };

  const getActionIcon = (action: string) => {
    const category = action.split('.')[0] || 'default';
    const Icon = ACTION_ICONS[category] || ACTION_ICONS.default;
    return Icon;
  };

  const getSeverity = (action: string): string => {
    if (action.includes('delete') || action.includes('suspend')) return 'critical';
    if (action.includes('update') || action.includes('modify')) return 'warning';
    if (action.includes('create') || action.includes('success')) return 'success';
    return 'info';
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">FINMA-compliant activity tracking</p>
        </div>
        <Button onClick={handleExportFINMA} className="gap-2 bg-[#1D4E5F] hover:bg-[#1D4E5F]/90">
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Export for FINMA
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <Input
                placeholder="Search by action, resource, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-gray-200"
              />
            </div>
            <div className="flex gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[140px] border-gray-200">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="user">User Actions</SelectItem>
                  <SelectItem value="api">API Access</SelectItem>
                  <SelectItem value="data">Data Changes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px] border-gray-200">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" strokeWidth={1.5} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{totalLogs}</p>
                <p className="text-sm text-gray-500">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <User className="h-5 w-5 text-green-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {logs.filter(l => l.action.includes('auth')).length}
                </p>
                <p className="text-sm text-gray-500">Auth Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Database className="h-5 w-5 text-yellow-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {logs.filter(l => l.action.includes('data') || l.action.includes('update')).length}
                </p>
                <p className="text-sm text-gray-500">Data Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {logs.filter(l => l.action.includes('error') || l.action.includes('fail')).length}
                </p>
                <p className="text-sm text-gray-500">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs table */}
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="text-gray-600 font-medium">Timestamp</TableHead>
                <TableHead className="text-gray-600 font-medium">Action</TableHead>
                <TableHead className="text-gray-600 font-medium">Resource</TableHead>
                <TableHead className="text-gray-600 font-medium">User</TableHead>
                <TableHead className="text-gray-600 font-medium">IP Address</TableHead>
                <TableHead className="text-gray-600 font-medium w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#1D4E5F] border-t-transparent rounded-full animate-spin" />
                      <span className="text-gray-500">Loading audit logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const Icon = getActionIcon(log.action);
                  const severity = getSeverity(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-gray-50/50">
                      <TableCell className="text-gray-500 text-sm font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                          <Badge 
                            variant="outline" 
                            className={cn(SEVERITY_COLORS[severity])}
                          >
                            {log.action}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {log.resource_type ? (
                          <span className="font-mono text-sm">
                            {log.resource_type}
                            {log.resource_id && (
                              <span className="text-gray-400">/{log.resource_id.slice(0, 8)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 font-mono text-sm">
                        {log.user_id?.slice(0, 8) || '-'}
                      </TableCell>
                      <TableCell className="text-gray-500 font-mono text-sm">
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              className="text-[#1D4E5F]"
                            >
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-500">Timestamp</p>
                                  <p className="font-mono text-sm">{new Date(log.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Action</p>
                                  <Badge variant="outline" className={cn(SEVERITY_COLORS[severity])}>
                                    {log.action}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">User ID</p>
                                  <p className="font-mono text-sm">{log.user_id || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">IP Address</p>
                                  <p className="font-mono text-sm">{log.ip_address || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Resource Type</p>
                                  <p className="font-mono text-sm">{log.resource_type || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Resource ID</p>
                                  <p className="font-mono text-sm">{log.resource_id || '-'}</p>
                                </div>
                              </div>
                              {log.user_agent && (
                                <div>
                                  <p className="text-sm text-gray-500 mb-1">User Agent</p>
                                  <p className="font-mono text-xs bg-gray-50 p-2 rounded">{log.user_agent}</p>
                                </div>
                              )}
                              {log.details && (
                                <div>
                                  <p className="text-sm text-gray-500 mb-1">Details</p>
                                  <pre className="font-mono text-xs bg-gray-50 p-3 rounded overflow-auto max-h-48">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.metadata && (
                                <div>
                                  <p className="text-sm text-gray-500 mb-1">Metadata</p>
                                  <pre className="font-mono text-xs bg-gray-50 p-3 rounded overflow-auto max-h-48">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} logs
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
