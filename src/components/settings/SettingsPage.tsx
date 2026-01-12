// src/components/settings/SettingsPage.tsx
import React from 'react';
import { Settings, User, Sliders, Link2, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from './ProfileSettings';
import { PreferencesSettings } from './PreferencesSettings';
import { IntegrationsPage } from '@/components/integrations/IntegrationsPage';

export function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Usage</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSettings />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsPage />
        </TabsContent>

        <TabsContent value="usage">
          <UsageStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsageStats() {
  const [stats, setStats] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.functions.invoke('usage-stats', {
          body: { action: 'summary' }
        });
        setStats(data?.summary);
      } catch (err) {
        console.error('Failed to fetch usage stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-[#1D4E5F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 rounded-lg border bg-white">
          <p className="text-sm text-gray-500">Total Tokens</p>
          <p className="text-3xl font-bold text-[#1D4E5F]">
            {((stats?.total_tokens || 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="p-6 rounded-lg border bg-white">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-3xl font-bold text-[#1D4E5F]">
            ${(stats?.total_cost_usd || 0).toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-lg border bg-white">
          <p className="text-sm text-gray-500">Total Requests</p>
          <p className="text-3xl font-bold text-[#1D4E5F]">
            {stats?.request_count || 0}
          </p>
        </div>
      </div>

      {stats?.by_model && (
        <div className="p-6 rounded-lg border bg-white">
          <h3 className="font-semibold mb-4">Usage by Model</h3>
          <div className="space-y-3">
            {stats.by_model.map((model: any) => (
              <div key={model.model_id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{model.model_id}</span>
                <div className="text-right">
                  <span className="text-sm">{(model.total_tokens / 1000).toFixed(1)}K tokens</span>
                  <span className="text-xs text-gray-500 ml-2">(${model.total_cost_usd?.toFixed(3)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
