// src/components/integrations/IntegrationsPage.tsx
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useOAuthConnectors } from '@/hooks/useOAuthConnectors';
import { IntegrationCard } from './IntegrationCard';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function IntegrationsPage() {
  const { connectors, isLoading, error, connect, disconnect, refresh } = useOAuthConnectors();
  const [searchParams, setSearchParams] = useSearchParams();

  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');

  // Clear URL params after showing message
  useEffect(() => {
    if (connectedParam || errorParam) {
      const timer = setTimeout(() => {
        setSearchParams({});
        refresh();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectedParam, errorParam, setSearchParams, refresh]);

  // Group by category
  const groupedConnectors = connectors.reduce((acc, connector) => {
    const category = connector.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(connector);
    return acc;
  }, {} as Record<string, typeof connectors>);

  const categoryLabels: Record<string, string> = {
    communication: 'Communication',
    calendar: 'Calendar',
    storage: 'Storage',
    productivity: 'Productivity',
    payment: 'Payments'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1D4E5F]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Connect your favorite tools to enhance SwissBrain's capabilities
        </p>
      </div>

      {connectedParam && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Successfully connected {connectedParam.replace('_', ' ')}!
          </AlertDescription>
        </Alert>
      )}

      {errorParam && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Connection failed: {errorParam.replace(/_/g, ' ')}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {Object.entries(groupedConnectors).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {categoryLabels[category] || category}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map(connector => (
                <IntegrationCard
                  key={connector.id}
                  {...connector}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  isLoading={isLoading}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500 text-center">
          All connections use secure OAuth 2.0 with PKCE. Your credentials are encrypted at rest.
          <br />
          SwissBrain never stores your passwords.
        </p>
      </div>
    </div>
  );
}
