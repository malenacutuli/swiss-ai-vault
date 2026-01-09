/**
 * StatusPage - Public system status page
 * Light themed with sovereignTeal accents
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Server,
  Database,
  Bot,
  Layers,
  Globe,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SystemStatus {
  api: 'operational' | 'degraded' | 'down';
  database: 'operational' | 'degraded' | 'down';
  ai: 'operational' | 'degraded' | 'down';
  warmPool: 'operational' | 'degraded' | 'down';
  warmPoolSize?: number;
  browser: 'operational' | 'degraded' | 'down';
  lastUpdated: Date;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  createdAt: Date;
  resolvedAt?: Date;
  updates: {
    message: string;
    timestamp: Date;
  }[];
}

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      // Simulate API call - in production, call actual status endpoint
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      setStatus({
        api: 'operational',
        database: 'operational',
        ai: 'operational',
        warmPool: 'operational',
        warmPoolSize: 45,
        browser: 'operational',
        lastUpdated: new Date(),
      });
      
      // Simulate no recent incidents
      setIncidents([]);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  const allOperational =
    status &&
    status.api === 'operational' &&
    status.database === 'operational' &&
    status.ai === 'operational' &&
    status.warmPool === 'operational' &&
    status.browser === 'operational';

  const uptimePercentage = 99.98; // Would be calculated from actual data

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <Link to="/" className="inline-block mb-6">
            <span className="text-2xl font-semibold text-gray-900">
              Swiss Br<span className="text-red-600">AI</span>n
            </span>
          </Link>
          <h1 className="font-['Playfair_Display'] text-4xl text-gray-900 mb-3">
            System Status
          </h1>
          <p className="text-gray-600">
            Current operational status of all Swiss BrAIn services
          </p>
        </header>

        {/* Overall status banner */}
        <div
          className={cn(
            'rounded-xl p-6 mb-8 border',
            allOperational
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          )}
        >
          <div className="flex items-center justify-center gap-3">
            {allOperational ? (
              <>
                <CheckCircle className="w-8 h-8 text-green-600" strokeWidth={1.5} />
                <span className="text-xl font-semibold text-green-800">
                  All Systems Operational
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-8 h-8 text-amber-600" strokeWidth={1.5} />
                <span className="text-xl font-semibold text-amber-800">
                  Some Systems Experiencing Issues
                </span>
              </>
            )}
          </div>
          <p className="text-center mt-2 text-sm text-gray-600">
            {uptimePercentage}% uptime over the last 90 days
          </p>
        </div>

        {/* Services list */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
            <h2 className="font-['Playfair_Display'] text-xl text-gray-900">
              Services
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              disabled={isLoading}
              className="text-gray-600 hover:text-[#1D4E5F]"
            >
              <RefreshCw
                className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')}
                strokeWidth={1.5}
              />
              Refresh
            </Button>
          </div>

          <div className="divide-y divide-gray-100">
            <StatusRow
              name="API Gateway"
              status={status?.api}
              icon={Server}
              detail="Core API endpoints"
            />
            <StatusRow
              name="Database"
              status={status?.database}
              icon={Database}
              detail="PostgreSQL (Swiss region)"
            />
            <StatusRow
              name="AI Services"
              status={status?.ai}
              icon={Bot}
              detail="LLM inference & processing"
            />
            <StatusRow
              name="Warm Pool"
              status={status?.warmPool}
              icon={Layers}
              detail={status?.warmPoolSize ? `${status.warmPoolSize} containers ready` : undefined}
            />
            <StatusRow
              name="Browser Automation"
              status={status?.browser}
              icon={Globe}
              detail="Headless browser service"
            />
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <MetricCard title="Uptime (90d)" value={`${uptimePercentage}%`} />
          <MetricCard title="Avg Response" value="124ms" />
          <MetricCard title="Active Users" value="2,847" />
        </div>

        {/* Recent Incidents */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
            <h2 className="font-['Playfair_Display'] italic text-xl text-gray-900">
              Recent Incidents
            </h2>
          </div>

          <div className="p-6">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" strokeWidth={1.5} />
                <p className="text-gray-600 font-medium">No incidents in the last 90 days</p>
                <p className="text-sm text-gray-400 mt-1">
                  All systems have been running smoothly
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Maintenance */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
            <h2 className="font-['Playfair_Display'] italic text-xl text-gray-900">
              Scheduled Maintenance
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Clock className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
              <p className="text-gray-500">No scheduled maintenance</p>
            </div>
          </div>
        </div>

        {/* Subscribe */}
        <div className="bg-[#1D4E5F]/5 rounded-xl border border-[#1D4E5F]/20 p-6 text-center mb-8">
          <h3 className="font-semibold text-gray-900 mb-2">Stay Informed</h3>
          <p className="text-sm text-gray-600 mb-4">
            Get notified about system status changes and scheduled maintenance
          </p>
          <Button className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white">
            Subscribe to Updates
          </Button>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4" strokeWidth={1.5} />
            Last updated: {lastRefresh.toLocaleString()}
          </div>
          <p>
            Made with precision in Switzerland
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link to="/" className="text-[#1D4E5F] hover:underline">
              Home
            </Link>
            <Link to="/security" className="text-[#1D4E5F] hover:underline">
              Security
            </Link>
            <a
              href="https://twitter.com/swissbrain"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1D4E5F] hover:underline inline-flex items-center gap-1"
            >
              Twitter
              <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface StatusRowProps {
  name: string;
  status?: 'operational' | 'degraded' | 'down';
  icon: LucideIcon;
  detail?: string;
}

function StatusRow({ name, status = 'operational', icon: Icon, detail }: StatusRowProps) {
  const config = {
    operational: {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-500',
      label: 'Operational',
    },
    degraded: {
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-500',
      label: 'Degraded',
    },
    down: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-500',
      label: 'Down',
    },
  }[status];

  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.5} />
        <span className="font-medium text-gray-900">{name}</span>
      </div>

      <div className="flex items-center gap-4">
        {detail && <span className="text-sm text-gray-500">{detail}</span>}
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', config.bg)} />
          <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
}

function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

interface IncidentCardProps {
  incident: Incident;
}

function IncidentCard({ incident }: IncidentCardProps) {
  const severityStyles = {
    minor: 'border-l-amber-400',
    major: 'border-l-orange-500',
    critical: 'border-l-red-600',
  };

  const statusLabels = {
    investigating: 'Investigating',
    identified: 'Identified',
    monitoring: 'Monitoring',
    resolved: 'Resolved',
  };

  return (
    <div
      className={cn(
        'border border-gray-200 rounded-lg p-4 border-l-4',
        severityStyles[incident.severity]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-gray-900">{incident.title}</h4>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(incident.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={cn(
            'px-2 py-1 text-xs rounded font-medium',
            incident.status === 'resolved'
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          )}
        >
          {statusLabels[incident.status]}
        </span>
      </div>
      {incident.updates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600">{incident.updates[0].message}</p>
        </div>
      )}
    </div>
  );
}
