import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Shield, 
  MapPin, 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText, 
  Download, 
  Trash2,
  ExternalLink,
  Server,
  Database,
  HardDrive,
  Activity,
  Lock,
  Eye,
  Calendar
} from 'lucide-react';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface AuditStats {
  totalEvents: number;
  eventsThisMonth: number;
  topActions: { action: string; count: number }[];
}

const complianceChecklist = [
  { id: 1, label: 'Data encrypted at rest (AWS S3 SSE)', status: 'complete', info: 'AES-256 encryption' },
  { id: 2, label: 'Data encrypted in transit (TLS 1.3)', status: 'complete', info: 'All connections secured' },
  { id: 3, label: 'Row Level Security enabled', status: 'complete', info: 'All tables protected' },
  { id: 4, label: 'Audit logging active', status: 'complete', info: 'Full event tracking' },
  { id: 5, label: 'Swiss data residency', status: 'complete', info: 'eu-central-2 (Zurich)' },
  { id: 6, label: 'SOC 2 Type II', status: 'in_progress', info: 'Audit in progress' },
  { id: 7, label: 'ISO 27001', status: 'planned', info: 'Q3 2025' },
  { id: 8, label: 'GDPR Article 30 records', status: 'complete', info: 'Available for export', link: true },
];

const dataResidencyItems = [
  { type: 'User data', location: 'Supabase (eu-central-2)', icon: Database },
  { type: 'Datasets', location: 'AWS S3 (eu-central-2)', icon: HardDrive },
  { type: 'Model checkpoints', location: 'AWS S3 (eu-central-2)', icon: Server },
  { type: 'Inference logs', location: 'Supabase (eu-central-2)', icon: Activity },
];

const certifications = [
  { name: 'GDPR', status: 'certified', year: '2024' },
  { name: 'SOC 2', status: 'in_progress', year: '2025' },
  { name: 'ISO 27001', status: 'planned', year: '2025' },
  { name: 'FINMA', status: 'planned', year: '2026' },
];

export default function Compliance() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retentionSettings, setRetentionSettings] = useState({
    tracesRetentionDays: 90,
    auditLogsRetentionDays: 365,
    inactiveDatasetsRetentionDays: 180,
  });
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditStats();
  }, []);

  const fetchAuditStats = async () => {
    try {
      // Fetch total events
      const { count: totalEvents } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      // Fetch events this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: eventsThisMonth } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      // For top actions, we'll show a summary
      const { data: recentLogs } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(100);

      const actionCounts: Record<string, number> = {};
      recentLogs?.forEach((log) => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      });

      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      setAuditStats({
        totalEvents: totalEvents || 0,
        eventsThisMonth: eventsThisMonth || 0,
        topActions,
      });
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportUserData = async () => {
    setExporting(true);
    try {
      // Simulate data export - in production this would call an Edge Function
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: 'Export started',
        description: 'Your data export is being prepared. You will receive a download link via email.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to start data export. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteUserData = async () => {
    setDeleting(true);
    try {
      // Simulate data deletion - in production this would call an Edge Function
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: 'Deletion request submitted',
        description: 'Your data deletion request has been submitted and will be processed within 30 days.',
      });
    } catch (error) {
      toast({
        title: 'Deletion failed',
        description: 'Failed to submit deletion request. Please contact support.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'planned':
        return <Circle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'certified':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Certified</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">In Progress</Badge>;
      case 'planned':
        return <Badge variant="outline">Planned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-[280px]'}`}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Compliance Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor data residency, compliance status, and security controls
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Data Residency Section */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Data Residency
                </CardTitle>
                <CardDescription>
                  All data is stored exclusively in Swiss and EU data centers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Swiss Map Visual */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                        <SwissFlag className="h-16 w-16" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="font-semibold text-foreground">AWS eu-central-2</p>
                      <p className="text-sm text-muted-foreground">Zurich, Switzerland</p>
                    </div>
                  </div>

                  {/* Data Types List */}
                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    {dataResidencyItems.map((item) => (
                      <div
                        key={item.type}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.type}</p>
                          <p className="text-sm text-muted-foreground">{item.location}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Lock className="h-5 w-5" />
                    <span className="font-medium">Swiss Data Sovereignty Guaranteed</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    All data is stored in AWS eu-central-2 (Zurich, Switzerland) and never leaves Swiss/EU jurisdiction.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Compliance Checklist
                </CardTitle>
                <CardDescription>
                  Current compliance status and certifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.status)}
                        <div>
                          <p className="font-medium text-foreground text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.info}</p>
                        </div>
                      </div>
                      {item.link && (
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Audit Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Audit Summary
                </CardTitle>
                <CardDescription>
                  Overview of audit logging activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    <div className="h-20 bg-muted animate-pulse rounded-lg" />
                    <div className="h-20 bg-muted animate-pulse rounded-lg" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-4 rounded-lg bg-muted/50 border text-center">
                        <p className="text-3xl font-bold text-foreground">
                          {auditStats?.totalEvents.toLocaleString() || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Events</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border text-center">
                        <p className="text-3xl font-bold text-foreground">
                          {auditStats?.eventsThisMonth.toLocaleString() || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">This Month</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Top Actions</p>
                      {auditStats?.topActions.length ? (
                        auditStats.topActions.map((action) => (
                          <div
                            key={action.action}
                            className="flex items-center justify-between p-2 rounded bg-muted/50"
                          >
                            <span className="text-sm text-foreground">{action.action}</span>
                            <Badge variant="outline">{action.count}</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No audit events recorded</p>
                      )}
                    </div>

                    <Link to="/dashboard/admin/audit-logs">
                      <Button variant="outline" className="w-full mt-4">
                        <FileText className="h-4 w-4 mr-2" />
                        View Full Audit Logs
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Data Retention */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Data Retention
                </CardTitle>
                <CardDescription>
                  Configure automatic data retention policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="traces-retention">Traces retention (days)</Label>
                  <Input
                    id="traces-retention"
                    type="number"
                    value={retentionSettings.tracesRetentionDays}
                    onChange={(e) => setRetentionSettings(prev => ({
                      ...prev,
                      tracesRetentionDays: parseInt(e.target.value) || 0
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Traces older than this will be automatically deleted
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audit-retention">Audit logs retention (days)</Label>
                  <Input
                    id="audit-retention"
                    type="number"
                    value={retentionSettings.auditLogsRetentionDays}
                    onChange={(e) => setRetentionSettings(prev => ({
                      ...prev,
                      auditLogsRetentionDays: parseInt(e.target.value) || 0
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 365 days recommended for compliance
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="datasets-retention">Inactive datasets retention (days)</Label>
                  <Input
                    id="datasets-retention"
                    type="number"
                    value={retentionSettings.inactiveDatasetsRetentionDays}
                    onChange={(e) => setRetentionSettings(prev => ({
                      ...prev,
                      inactiveDatasetsRetentionDays: parseInt(e.target.value) || 0
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Datasets not accessed within this period will be flagged for review
                  </p>
                </div>

                <Button className="w-full">Save Retention Settings</Button>
              </CardContent>
            </Card>

            {/* GDPR Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  GDPR Tools
                </CardTitle>
                <CardDescription>
                  Data portability and right to erasure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Export All User Data</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Download a ZIP file containing all your data: datasets, models, settings, and traces.
                  </p>
                  <Button 
                    onClick={handleExportUserData} 
                    disabled={exporting}
                    className="w-full"
                  >
                    {exporting ? 'Preparing Export...' : 'Export My Data'}
                  </Button>
                </div>

                <Separator />

                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">Delete All User Data</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all your data. This action cannot be undone.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Request Data Deletion
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all your data including datasets, fine-tuned models, 
                          evaluations, traces, and settings. This action cannot be undone and will be 
                          processed within 30 days as per GDPR requirements.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteUserData}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? 'Processing...' : 'Delete All Data'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            {/* Certifications */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Certifications & Roadmap
                </CardTitle>
                <CardDescription>
                  Current certifications and upcoming compliance milestones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {certifications.map((cert) => (
                    <div
                      key={cert.name}
                      className={`p-4 rounded-xl border text-center ${
                        cert.status === 'certified'
                          ? 'bg-green-500/5 border-green-500/20'
                          : cert.status === 'in_progress'
                          ? 'bg-yellow-500/5 border-yellow-500/20'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-center mb-3">
                        {cert.status === 'certified' ? (
                          <div className="p-3 rounded-full bg-green-500/10">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                          </div>
                        ) : cert.status === 'in_progress' ? (
                          <div className="p-3 rounded-full bg-yellow-500/10">
                            <Clock className="h-8 w-8 text-yellow-500" />
                          </div>
                        ) : (
                          <div className="p-3 rounded-full bg-muted">
                            <Circle className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground">{cert.name}</h3>
                      <div className="mt-2">
                        {getStatusBadge(cert.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{cert.year}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
