/**
 * AlertsPanel - UI for viewing and managing alerts
 * Light themed with sovereignTeal accents
 */

import { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Settings,
  RefreshCw,
  Eye,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertManager,
  AlertRule,
  AlertNotification,
  alertManager,
} from '@/lib/monitoring/AlertManager';

interface AlertsPanelProps {
  className?: string;
}

export function AlertsPanel({ className }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'rules'>('active');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalFired: 0,
    totalResolved: 0,
    avgResolutionTimeMs: 0,
  });

  useEffect(() => {
    loadData();
    
    // Subscribe to alert updates
    alertManager.onAlert((notification) => {
      setAlerts(alertManager.getAlertHistory());
    });

    // Start evaluation if not running
    alertManager.startEvaluationLoop(30000);

    return () => {
      alertManager.stopEvaluationLoop();
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setAlerts(alertManager.getAlertHistory());
      setRules(alertManager.getRules());
      setStats(alertManager.getStats());
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    alertManager.acknowledgeAlert(alertId, 'current-user', 'Acknowledged via UI');
    setAlerts(alertManager.getAlertHistory());
  };

  const handleToggleRule = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      alertManager.updateRule(ruleId, { enabled: !rule.enabled });
      setRules(alertManager.getRules());
    }
  };

  const toggleRuleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const activeAlerts = alerts.filter((a) => a.status === 'firing');
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'acknowledged');

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1.5} />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={1.5} />;
      default:
        return <Info className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.5} />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      warning: 'bg-amber-100 text-amber-700 border-amber-200',
      info: 'bg-[#1D4E5F]/10 text-[#1D4E5F] border-[#1D4E5F]/20',
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-[#1D4E5F]" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
          {activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {activeAlerts.length} Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="text-gray-600 hover:text-[#1D4E5F]"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-[#1D4E5F]"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">{stats.totalFired}</p>
          <p className="text-xs text-gray-500">Total Fired</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">{stats.totalResolved}</p>
          <p className="text-xs text-gray-500">Resolved</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">
            {alertManager.formatMTTR()}
          </p>
          <p className="text-xs text-gray-500">Avg MTTR</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        {(['active', 'history', 'rules'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab
                ? 'border-[#1D4E5F] text-[#1D4E5F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'active' && (
          <div className="p-6">
            {activeAlerts.length === 0 && acknowledgedAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2
                  className="w-12 h-12 text-green-500 mb-4"
                  strokeWidth={1.5}
                />
                <p className="text-lg font-medium text-gray-900">All systems operational</p>
                <p className="text-sm text-gray-500 mt-1">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => handleAcknowledge(alert.id)}
                  />
                ))}

                {acknowledgedAlerts.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-4">
                      <span className="text-sm font-medium text-gray-500">
                        Acknowledged ({acknowledgedAlerts.length})
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    {acknowledgedAlerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-gray-300 mb-4" strokeWidth={1.5} />
                <p className="text-gray-500">No alert history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice().reverse().map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    {getSeverityIcon(alert.rule.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {alert.rule.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Value: {alert.value.toFixed(2)} (threshold: {alert.rule.threshold})
                      </p>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs rounded border',
                        alert.status === 'firing'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : alert.status === 'resolved'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                      )}
                    >
                      {alert.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(alert.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="p-6 space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <button
                  onClick={() => toggleRuleExpanded(rule.id)}
                  className="flex items-center gap-3 w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {expandedRules.has(rule.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                  )}
                  {getSeverityIcon(rule.severity)}
                  <span className="flex-1 font-medium text-gray-900">{rule.name}</span>
                  <span className={cn('px-2 py-0.5 text-xs rounded border', getSeverityBadge(rule.severity))}>
                    {rule.severity}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRule(rule.id);
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      rule.enabled
                        ? 'text-[#1D4E5F] hover:bg-[#1D4E5F]/10'
                        : 'text-gray-400 hover:bg-gray-100'
                    )}
                  >
                    {rule.enabled ? (
                      <Bell className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <BellOff className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </button>

                {expandedRules.has(rule.id) && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">Metric:</span>
                        <code className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                          {rule.metric}
                        </code>
                      </div>
                      <div>
                        <span className="text-gray-500">Condition:</span>
                        <span className="ml-2 font-medium text-gray-700">
                          {rule.condition} {rule.threshold}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 font-medium text-gray-700">{rule.duration}s</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Channels:</span>
                        <span className="ml-2 font-medium text-gray-700">
                          {rule.channels.map((c) => c.type).join(', ')}
                        </span>
                      </div>
                    </div>
                    {rule.description && (
                      <p className="mt-3 text-sm text-gray-600">{rule.description}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AlertCardProps {
  alert: AlertNotification;
  onAcknowledge?: () => void;
}

function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-300 bg-red-50';
      case 'warning':
        return 'border-amber-300 bg-amber-50';
      default:
        return 'border-[#1D4E5F]/30 bg-[#1D4E5F]/5';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" strokeWidth={1.5} />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={1.5} />;
      default:
        return <Info className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.5} />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border-2',
        getSeverityStyles(alert.rule.severity),
        alert.status === 'acknowledged' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {getSeverityIcon(alert.rule.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{alert.rule.name}</h3>
            <span
              className={cn(
                'px-2 py-0.5 text-xs rounded uppercase font-medium',
                alert.status === 'firing'
                  ? 'bg-red-200 text-red-800'
                  : 'bg-amber-200 text-amber-800'
              )}
            >
              {alert.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            <code className="bg-white/50 px-1 rounded">{alert.rule.metric}</code> is{' '}
            <span className="font-medium">{alert.value.toFixed(2)}</span> (threshold:{' '}
            {alert.rule.threshold})
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              {formatTime(alert.timestamp)}
            </span>
            {alert.acknowledgedBy && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" strokeWidth={1.5} />
                Ack by {alert.acknowledgedBy}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAcknowledge && alert.status === 'firing' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAcknowledge}
              className="text-xs border-gray-300"
            >
              <Eye className="w-3 h-3 mr-1" strokeWidth={1.5} />
              Acknowledge
            </Button>
          )}
          {alert.rule.runbook && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(alert.rule.runbook, '_blank')}
              className="text-xs text-[#1D4E5F]"
            >
              <MessageSquare className="w-3 h-3 mr-1" strokeWidth={1.5} />
              Runbook
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
