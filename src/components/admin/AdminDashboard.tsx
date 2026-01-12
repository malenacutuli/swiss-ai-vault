// src/components/admin/AdminDashboard.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminOverview } from './AdminOverview';
import { OrgAnalyticsDashboard } from './OrgAnalyticsDashboard';
import { SystemHealth } from './SystemHealth';
import { useOrgAnalytics } from '@/hooks/useAdminStats';

export function AdminDashboard() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { analytics, engagement, isLoading } = useOrgAnalytics(selectedOrgId);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="analytics">
          <OrgAnalyticsDashboard analytics={analytics} engagement={engagement} />
        </TabsContent>

        <TabsContent value="health">
          <SystemHealth />
        </TabsContent>
      </Tabs>
    </div>
  );
}
