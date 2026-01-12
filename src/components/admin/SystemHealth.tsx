// src/components/admin/SystemHealth.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  message?: string;
  timestamp: string;
}

interface SystemHealthData {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  version: string;
}

export function SystemHealth() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async (detailed = false, runTests = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (detailed) params.append('detailed', 'true');
      if (runTests) params.append('test', 'true');

      const { data, error: fetchError } = await supabase.functions.invoke('swiss-health', {
        body: null,
        headers: {}
      });

      if (fetchError) throw fetchError;
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const serviceLabels: Record<string, string> = {
    swiss_k8s_api: 'Swiss K8s API',
    swiss_python_sandbox: 'Python Sandbox',
    supabase: 'Database',
    redis_upstash: 'Redis Cache',
    gemini_api: 'Gemini AI'
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Health
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHealth(true, false)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fetchHealth(true, true)}
            disabled={isLoading}
            className="bg-[#1D4E5F] hover:bg-[#163d4d]"
          >
            Run Tests
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {health && (
          <>
            <div className={`flex items-center justify-between mb-6 p-4 rounded-lg border ${getStatusColor(health.overall_status)}`}>
              <div className="flex items-center gap-3">
                {getStatusIcon(health.overall_status)}
                <span className="font-semibold capitalize">
                  System {health.overall_status}
                </span>
              </div>
              <Badge variant="outline">v{health.version}</Badge>
            </div>

            <div className="space-y-3">
              {health.checks.map((check) => (
                <div
                  key={check.service}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <p className="font-medium">
                        {serviceLabels[check.service] || check.service}
                      </p>
                      {check.message && (
                        <p className="text-sm text-gray-500">{check.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(check.status)}>
                      {check.status}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {check.latency_ms}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </p>
          </>
        )}

        {isLoading && !health && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1D4E5F]" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
