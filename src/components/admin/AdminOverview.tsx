// src/components/admin/AdminOverview.tsx
import React from 'react';
import {
  Activity, Database, Cpu, Users, Zap, DollarSign,
  CheckCircle, AlertTriangle, XCircle, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/useAdminStats';

export function AdminOverview() {
  const { stats, isLoading, error, refresh } = useAdminStats();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      healthy: 'bg-green-100 text-green-800',
      degraded: 'bg-yellow-100 text-yellow-800',
      unhealthy: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">System overview and monitoring</p>
        </div>
        <Button onClick={refresh} disabled={isLoading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">System Status</p>
                <p className="text-2xl font-bold capitalize">
                  {stats.systemHealth?.overall_status || 'Unknown'}
                </p>
              </div>
              {getStatusIcon(stats.systemHealth?.overall_status || '')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cache Hit Rate</p>
                <p className="text-2xl font-bold">
                  {stats.cacheStats?.hit_rate?.toFixed(1) || 0}%
                </p>
              </div>
              <Zap className="w-5 h-5 text-[#1D4E5F]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tokens Saved</p>
                <p className="text-2xl font-bold">
                  {((stats.cacheStats?.tokens_saved || 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <Database className="w-5 h-5 text-[#1D4E5F]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cost Saved</p>
                <p className="text-2xl font-bold">
                  ${(stats.cacheStats?.cost_saved_usd || 0).toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.systemHealth?.checks?.map((check) => (
              <div
                key={check.service}
                className="flex items-center justify-between p-3 rounded-lg border bg-white"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <p className="font-medium">{check.service.replace(/_/g, ' ')}</p>
                    {check.message && (
                      <p className="text-sm text-gray-500">{check.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={getStatusBadge(check.status)}>
                    {check.status}
                  </Badge>
                  <span className="text-sm text-gray-400">
                    {check.latency_ms}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            AI Model Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.modelHealth?.slice(0, 9).map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{model.display_name}</p>
                  <p className="text-xs text-gray-500">{model.provider}</p>
                </div>
                <Badge className={getStatusBadge(model.health?.status || 'unknown')}>
                  {model.health?.status || 'unknown'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
