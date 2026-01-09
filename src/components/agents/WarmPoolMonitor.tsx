/**
 * Warm Pool Monitor Dashboard
 * Visualizes container pool status, metrics, and health
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Activity, 
  Clock, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Thermometer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TemplateStats {
  warm: number;
  assigned: number;
  expired: number;
  target: number;
  hitRate: number;
}

interface PoolStats {
  region: string;
  templates: Record<string, TemplateStats>;
  totalWarm: number;
  totalAssigned: number;
  totalTarget: number;
  metrics: {
    warmHits: number;
    coldStarts: number;
    warmHitRate: number;
    coldStartRate: number;
    avgAcquisitionMs: number;
    periodMinutes: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    poolUtilization: number;
    meetsTargetSLA: boolean;
  };
  timestamp: string;
}

const TEMPLATE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  'web-static': { label: 'Static Web', icon: <Server className="w-4 h-4" /> },
  'web-server': { label: 'Web Server', icon: <Activity className="w-4 h-4" /> },
  'web-db-user': { label: 'Web + DB', icon: <Server className="w-4 h-4" /> },
  'python-data': { label: 'Python Data', icon: <Zap className="w-4 h-4" /> },
  'generic': { label: 'Generic', icon: <Server className="w-4 h-4" /> },
};

export function WarmPoolMonitor() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('eu-central-2');

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('pool-stats', {
        body: { region: selectedRegion },
      });

      if (fetchError) throw fetchError;
      
      setStats(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch pool stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [selectedRegion]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'degraded':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTemperatureColor = (utilization: number) => {
    if (utilization >= 80) return 'text-green-500';
    if (utilization >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span>Error loading pool stats: {error}</span>
          </div>
          <Button onClick={fetchStats} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Thermometer className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Warm Container Pool</h2>
            <p className="text-sm text-muted-foreground">
              Real-time container pool monitoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={selectedRegion} onValueChange={setSelectedRegion}>
            <TabsList>
              <TabsTrigger value="eu-central-2">🇨🇭 Swiss</TabsTrigger>
              <TabsTrigger value="eu-central-1">🇩🇪 Frankfurt</TabsTrigger>
              <TabsTrigger value="us-east-1">🇺🇸 US East</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={fetchStats} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {stats && (
        <>
          {/* Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pool Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusColor(stats.health.status)}>
                        {getStatusIcon(stats.health.status)}
                        <span className="ml-1 capitalize">{stats.health.status}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className={`text-3xl font-bold ${getTemperatureColor(stats.health.poolUtilization)}`}>
                    {stats.health.poolUtilization}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Warm Containers</p>
                    <p className="text-2xl font-bold">{stats.totalWarm}</p>
                    <p className="text-xs text-muted-foreground">
                      Target: {stats.totalTarget}
                    </p>
                  </div>
                  <Server className="w-8 h-8 text-muted-foreground" />
                </div>
                <Progress 
                  value={(stats.totalWarm / stats.totalTarget) * 100} 
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Warm Hit Rate</p>
                    <p className="text-2xl font-bold">{stats.metrics.warmHitRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      Target: ≥90%
                    </p>
                  </div>
                  {stats.metrics.warmHitRate >= 90 ? (
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Acquisition</p>
                    <p className="text-2xl font-bold">{stats.metrics.avgAcquisitionMs}ms</p>
                    <p className="text-xs text-muted-foreground">
                      Target: &lt;500ms
                    </p>
                  </div>
                  <Clock className={`w-8 h-8 ${stats.health.meetsTargetSLA ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Container Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.templates).map(([template, templateStats]) => {
                  const info = TEMPLATE_LABELS[template] || { label: template, icon: <Server className="w-4 h-4" /> };
                  const fillPercentage = (templateStats.warm / templateStats.target) * 100;
                  
                  return (
                    <div key={template} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {info.icon}
                          <span className="font-medium">{info.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-500">
                            {templateStats.warm} warm
                          </span>
                          <span className="text-blue-500">
                            {templateStats.assigned} assigned
                          </span>
                          <span className="text-muted-foreground">
                            Target: {templateStats.target}
                          </span>
                          <Badge variant="outline">
                            {templateStats.hitRate}% hit rate
                          </Badge>
                        </div>
                      </div>
                      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="absolute left-0 top-0 h-full bg-green-500/50 rounded-full transition-all"
                          style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                        />
                        <div 
                          className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.min((templateStats.warm / templateStats.target) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Metrics Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Last Hour Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Warm Hits</p>
                  <p className="text-xl font-bold text-green-500">
                    {stats.metrics.warmHits}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Cold Starts</p>
                  <p className="text-xl font-bold text-orange-500">
                    {stats.metrics.coldStarts}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Cold Start Rate</p>
                  <p className="text-xl font-bold">
                    {stats.metrics.coldStartRate}%
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="text-xl font-bold">
                    {stats.metrics.periodMinutes} min
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Update */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {lastUpdate?.toLocaleTimeString() || 'Never'}
          </div>
        </>
      )}

      {isLoading && !stats && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default WarmPoolMonitor;
