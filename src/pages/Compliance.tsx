import { useState, useEffect } from 'react';
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
} from '@/icons';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AuditStats {
  totalEvents: number;
  eventsThisMonth: number;
  topActions: { action: string; count: number }[];
}

const certifications = [
  { name: 'GDPR', status: 'in_progress' },
  { name: 'SOC 2', status: 'in_progress' },
  { name: 'ISO 27001', status: 'planned' },
  { name: 'FINMA', status: 'planned' },
];

export default function Compliance() {
  const { t } = useTranslation();
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
        title: t('compliance.dashboard.export.started'),
        description: t('compliance.dashboard.export.startedDesc'),
      });
    } catch (error) {
      toast({
        title: t('compliance.dashboard.export.failed'),
        description: t('compliance.dashboard.export.failedDesc'),
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
        title: t('compliance.dashboard.delete.submitted'),
        description: t('compliance.dashboard.delete.submittedDesc'),
      });
    } catch (error) {
      toast({
        title: t('compliance.dashboard.delete.failed'),
        description: t('compliance.dashboard.delete.failedDesc'),
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
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">{t('compliance.dashboard.status.certified')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">{t('compliance.dashboard.status.inProgress')}</Badge>;
      case 'planned':
        return <Badge variant="outline">{t('compliance.dashboard.status.planned')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Translated compliance checklist
  const complianceChecklistTranslated = [
    { id: 1, label: t('compliance.dashboard.checklist.encryptionAtRest'), status: 'complete', info: t('compliance.dashboard.checklist.encryptionAtRestInfo') },
    { id: 2, label: t('compliance.dashboard.checklist.encryptionInTransit'), status: 'complete', info: t('compliance.dashboard.checklist.encryptionInTransitInfo') },
    { id: 3, label: t('compliance.dashboard.checklist.apiKeySecurity'), status: 'complete', info: t('compliance.dashboard.checklist.apiKeySecurityInfo') },
    { id: 4, label: t('compliance.dashboard.checklist.rowLevelSecurity'), status: 'complete', info: t('compliance.dashboard.checklist.rowLevelSecurityInfo') },
    { id: 5, label: t('compliance.dashboard.checklist.auditLogging'), status: 'complete', info: t('compliance.dashboard.checklist.auditLoggingInfo') },
    { id: 6, label: t('compliance.dashboard.checklist.swissDataResidency'), status: 'complete', info: t('compliance.dashboard.checklist.swissDataResidencyInfo') },
    { id: 7, label: 'SOC 2 Type II', status: 'in_progress', info: t('compliance.dashboard.checklist.soc2Info') },
    { id: 8, label: 'ISO 27001', status: 'planned', info: t('compliance.dashboard.checklist.iso27001Info') },
    { id: 9, label: t('compliance.dashboard.checklist.gdprRecords'), status: 'complete', info: t('compliance.dashboard.checklist.gdprRecordsInfo'), link: true },
  ];

  // Translated data residency items
  const dataResidencyItemsTranslated = [
    { type: t('compliance.dashboard.residency.userData'), icon: Database },
    { type: t('compliance.dashboard.residency.datasets'), icon: HardDrive },
    { type: t('compliance.dashboard.residency.modelCheckpoints'), icon: Server },
    { type: t('compliance.dashboard.residency.inferenceLogs'), icon: Activity },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t('compliance.dashboard.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('compliance.dashboard.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Data Residency Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t('compliance.dashboard.residency.title')}
            </CardTitle>
            <CardDescription>
              {t('compliance.dashboard.residency.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
            {/* Swiss Flag Visual */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                    <img src="/favicon.svg" alt="Swiss Flag" className="h-16 w-16" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('compliance.dashboard.residency.location')}</p>
                </div>
              </div>

              {/* Data Types List */}
              <div className="flex-1 grid gap-3 sm:grid-cols-2">
                {dataResidencyItemsTranslated.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border"
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Lock className="h-5 w-5" />
                <span className="font-medium">{t('compliance.dashboard.residency.sovereigntyTitle')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('compliance.dashboard.residency.sovereigntyDesc')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t('compliance.dashboard.checklist.title')}
            </CardTitle>
            <CardDescription>
              {t('compliance.dashboard.checklist.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complianceChecklistTranslated.map((item) => (
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
              {t('compliance.dashboard.audit.title')}
            </CardTitle>
            <CardDescription>
              {t('compliance.dashboard.audit.description')}
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
                    <p className="text-sm text-muted-foreground">{t('compliance.dashboard.audit.totalEvents')}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border text-center">
                    <p className="text-3xl font-bold text-foreground">
                      {auditStats?.eventsThisMonth.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('compliance.dashboard.audit.thisMonth')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t('compliance.dashboard.audit.topActions')}</p>
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
                    <p className="text-sm text-muted-foreground">{t('compliance.dashboard.audit.noEvents')}</p>
                  )}
                </div>

                <Link to="/labs/admin/audit-logs">
                  <Button variant="outline" className="w-full mt-4">
                    <FileText className="h-4 w-4 mr-2" />
                    {t('compliance.dashboard.audit.viewFullLogs')}
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
              {t('compliance.dashboard.retention.title')}
            </CardTitle>
            <CardDescription>
              {t('compliance.dashboard.retention.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="traces-retention">{t('compliance.dashboard.retention.tracesRetention')}</Label>
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
                {t('compliance.dashboard.retention.tracesRetentionDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-retention">{t('compliance.dashboard.retention.auditRetention')}</Label>
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
                {t('compliance.dashboard.retention.auditRetentionDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="datasets-retention">{t('compliance.dashboard.retention.datasetsRetention')}</Label>
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
                {t('compliance.dashboard.retention.datasetsRetentionDesc')}
              </p>
            </div>

            <Button className="w-full">{t('compliance.dashboard.retention.saveSettings')}</Button>
          </CardContent>
        </Card>

        {/* GDPR Tools */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('compliance.dashboard.gdprTools.title')}
            </CardTitle>
            <CardDescription>
              {t('compliance.dashboard.gdprTools.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">{t('compliance.dashboard.gdprTools.exportTitle')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('compliance.dashboard.gdprTools.exportDesc')}
              </p>
              <Button 
                onClick={handleExportUserData} 
                disabled={exporting}
                className="w-full"
              >
                {exporting ? t('compliance.dashboard.gdprTools.exportingButton') : t('compliance.dashboard.gdprTools.exportButton')}
              </Button>
            </div>

            <Separator />

            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">{t('compliance.dashboard.gdprTools.deleteTitle')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('compliance.dashboard.gdprTools.deleteDesc')}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    {t('compliance.dashboard.gdprTools.deleteButton')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('compliance.dashboard.gdprTools.deleteDialogTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('compliance.dashboard.gdprTools.deleteDialogDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('compliance.dashboard.gdprTools.deleteDialogCancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteUserData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? t('compliance.dashboard.gdprTools.deletingButton') : t('compliance.dashboard.gdprTools.deleteDialogConfirm')}
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
            <CardTitle>
              {t('compliance.dashboard.certifications.title')}
            </CardTitle>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
