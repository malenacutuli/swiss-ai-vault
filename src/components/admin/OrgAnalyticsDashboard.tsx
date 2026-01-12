// src/components/admin/OrgAnalyticsDashboard.tsx
import React from 'react';
import { Users, MessageSquare, Cpu, Coins, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrgAnalyticsProps {
  analytics: any;
  engagement: any;
}

export function OrgAnalyticsDashboard({ analytics, engagement }: OrgAnalyticsProps) {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">
        No analytics data available
      </div>
    );
  }

  const summary = analytics.summary || {};

  return (
    <div className="space-y-6">
      {/* Engagement Metrics */}
      {engagement && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">DAU</p>
                  <p className="text-2xl font-bold">{engagement.dau || 0}</p>
                  <p className="text-xs text-gray-400">{engagement.dau_rate}% of members</p>
                </div>
                <Users className="w-5 h-5 text-[#1D4E5F]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">WAU</p>
                  <p className="text-2xl font-bold">{engagement.wau || 0}</p>
                  <p className="text-xs text-gray-400">{engagement.wau_rate}% of members</p>
                </div>
                <Calendar className="w-5 h-5 text-[#1D4E5F]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">MAU</p>
                  <p className="text-2xl font-bold">{engagement.mau || 0}</p>
                  <p className="text-xs text-gray-400">{engagement.mau_rate}% of members</p>
                </div>
                <TrendingUp className="w-5 h-5 text-[#1D4E5F]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Stickiness</p>
                  <p className="text-2xl font-bold">{engagement.stickiness || 0}%</p>
                  <p className="text-xs text-gray-400">DAU/MAU ratio</p>
                </div>
                <Badge className={
                  engagement.stickiness > 20 ? 'bg-green-100 text-green-800' :
                  engagement.stickiness > 10 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {engagement.stickiness > 20 ? 'Good' : engagement.stickiness > 10 ? 'Fair' : 'Low'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sessions</p>
                <p className="text-2xl font-bold">{summary.total_sessions?.toLocaleString() || 0}</p>
              </div>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Chat Messages</p>
                <p className="text-2xl font-bold">{summary.total_messages?.toLocaleString() || 0}</p>
              </div>
              <MessageSquare className="w-5 h-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Agent Tasks</p>
                <p className="text-2xl font-bold">{summary.total_tasks?.toLocaleString() || 0}</p>
              </div>
              <Cpu className="w-5 h-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tokens Used</p>
                <p className="text-2xl font-bold">
                  {((summary.total_tokens || 0) / 1000000).toFixed(2)}M
                </p>
              </div>
              <Coins className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.by_day?.slice(0, 7).map((day: any) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-500">{day.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-[#1D4E5F] h-full rounded-full"
                    style={{
                      width: `${Math.min((day.sessions / (analytics.by_day?.[0]?.sessions || 1)) * 100, 100)}%`
                    }}
                  />
                </div>
                <span className="w-16 text-sm text-right">{day.sessions} sessions</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Users */}
      {analytics.top_users && (
        <Card>
          <CardHeader>
            <CardTitle>Top Users by Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.top_users.map((user: any, idx: number) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1D4E5F] text-white text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-mono">{user.user_id.slice(0, 8)}...</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{(user.tokens / 1000).toFixed(1)}K tokens</p>
                    <p className="text-xs text-gray-500">{user.tasks} tasks</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
