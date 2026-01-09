import { useState, useEffect } from 'react';
import { Zap, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HMRMetrics {
  p50: number;
  p95: number;
  avg: number;
  count: number;
  meetsTarget: boolean;
}

interface HMRStatusIndicatorProps {
  connected: boolean;
  metrics?: HMRMetrics | null;
  lastLatency?: number | null;
  className?: string;
}

export function HMRStatusIndicator({ 
  connected, 
  metrics, 
  lastLatency,
  className 
}: HMRStatusIndicatorProps) {
  const [showMetrics, setShowMetrics] = useState(false);

  const getStatusColor = () => {
    if (!connected) return 'bg-gray-300';
    if (metrics?.meetsTarget) return 'bg-green-500';
    if (metrics && metrics.p50 < 150) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600';
    if (latency < 150) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setShowMetrics(!showMetrics)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors duration-200"
      >
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", getStatusColor())} />
          <span className="text-xs text-gray-600">
            {connected ? 'HMR' : 'Offline'}
          </span>
        </div>

        {/* Last latency */}
        {lastLatency !== null && lastLatency !== undefined && (
          <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
            <Zap className="h-3 w-3 text-[#1D4E5F]" strokeWidth={1.5} />
            <span className={cn("text-xs font-mono", getLatencyColor(lastLatency))}>
              {lastLatency}ms
            </span>
          </div>
        )}
      </button>

      {/* Metrics dropdown */}
      {showMetrics && metrics && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">HMR Performance</h4>
            {metrics.meetsTarget ? (
              <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" strokeWidth={1.5} />
            )}
          </div>

          <div className="space-y-2">
            {/* P50 Latency */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">P50 Latency</span>
              <span className={cn(
                "text-xs font-mono",
                getLatencyColor(metrics.p50)
              )}>
                {metrics.p50.toFixed(1)}ms
              </span>
            </div>

            {/* P95 Latency */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">P95 Latency</span>
              <span className="text-xs font-mono text-gray-700">
                {metrics.p95.toFixed(1)}ms
              </span>
            </div>

            {/* Average */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Average</span>
              <span className="text-xs font-mono text-gray-700">
                {metrics.avg.toFixed(1)}ms
              </span>
            </div>

            {/* Update count */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">Updates</span>
              <span className="text-xs font-mono text-gray-700">
                {metrics.count}
              </span>
            </div>
          </div>

          {/* Target indicator */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs">
              <Activity className="h-3 w-3 text-gray-400" strokeWidth={1.5} />
              <span className="text-gray-500">
                Target: {"<"}100ms P50
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
