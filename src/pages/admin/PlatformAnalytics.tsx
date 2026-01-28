// src/pages/admin/PlatformAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  Globe, 
  Clock,
  Zap,
  UserPlus,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { 
  usePlatformAnalyticsSummary, 
  useRecentSignups, 
  useFeatureUsageStats,
  useUserCostBreakdown,
  useUserActivityDetails
} from '@/hooks/usePlatformAnalytics';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface RecentSignup {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  signup_method: string;
  country_code: string | null;
  city: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser: string | null;
  tier_assigned: string;
  created_at: string;
}

function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignupRow({ signup, onClick }: { signup: RecentSignup; onClick: () => void }) {
  return (
    <div 
      className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{signup.email}</span>
          <Badge variant="outline" className="text-xs">
            {signup.signup_method}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          {signup.country_code && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {signup.city ? `${signup.city}, ${signup.country_code}` : signup.country_code}
            </span>
          )}
          {signup.utm_source && (
            <span>via {signup.utm_source}</span>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
        {formatDistanceToNow(new Date(signup.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

function UserDrilldown({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: activity, isLoading } = useUserActivityDetails(userId);

  if (isLoading) {
    return (
      <Card className="absolute right-0 top-0 w-96 z-10 shadow-lg">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activity) return null;

  return (
    <Card className="absolute right-0 top-0 w-96 z-10 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">User Activity</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Sessions</div>
            <div className="font-semibold">{activity.total_sessions}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Page Views</div>
            <div className="font-semibold">{activity.total_page_views}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Features Used</div>
            <div className="font-semibold">{activity.total_feature_uses}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
            <div className="font-semibold">${Number(activity.total_cost || 0).toFixed(4)}</div>
          </div>
        </div>

        {activity.feature_breakdown && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Feature Usage</div>
            <div className="space-y-1">
              {Object.entries(activity.feature_breakdown).map(([feature, count]) => (
                <div key={feature} className="flex justify-between text-sm">
                  <span className="capitalize">{feature}</span>
                  <span className="text-muted-foreground">{String(count)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activity.first_seen && (
          <div className="text-xs text-muted-foreground">
            First seen: {formatDistanceToNow(new Date(activity.first_seen), { addSuffix: true })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlatformAnalytics() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [liveSignups, setLiveSignups] = useState<RecentSignup[]>([]);
  
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = usePlatformAnalyticsSummary(30);
  const { data: recentSignups, isLoading: signupsLoading, refetch: refetchSignups } = useRecentSignups(50);
  const { data: featureStats, isLoading: featuresLoading } = useFeatureUsageStats(30);
  const { data: costBreakdown, isLoading: costLoading } = useUserCostBreakdown(30);

  // Real-time signups subscription
  useEffect(() => {
    const channel = supabase
      .channel('signups_live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_signups'
        },
        (payload) => {
          const newSignup = payload.new as RecentSignup;
          setLiveSignups(prev => [newSignup, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = () => {
    refetchSummary();
    refetchSignups();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
          <p className="text-muted-foreground">Real-time visibility into user activity and costs</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Live Activity Banner */}
      {liveSignups.length > 0 && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                New signup: {liveSignups[0].email}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {formatDistanceToNow(new Date(liveSignups[0].created_at), { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Users Now"
          value={summaryLoading ? '...' : summary?.active_sessions || 0}
          description="Sessions active in last 15 min"
          icon={Activity}
        />
        <MetricCard
          title="Signups Today"
          value={summaryLoading ? '...' : summary?.signups_today || 0}
          description={`${summary?.signups_this_month || 0} this month`}
          icon={UserPlus}
        />
        <MetricCard
          title="Cost Today"
          value={summaryLoading ? '...' : `$${Number(summary?.total_cost_today || 0).toFixed(2)}`}
          description={`$${Number(summary?.total_cost_this_month || 0).toFixed(2)} this month`}
          icon={DollarSign}
        />
        <MetricCard
          title="Avg Session Duration"
          value={summaryLoading ? '...' : formatDuration(summary?.avg_session_duration || 0)}
          description={`${summary?.total_sessions_today || 0} sessions today`}
          icon={Clock}
        />
      </div>

      <Tabs defaultValue="signups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="signups">Recent Signups</TabsTrigger>
          <TabsTrigger value="features">Feature Usage</TabsTrigger>
          <TabsTrigger value="costs">User Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="signups">
          <Card>
            <CardHeader>
              <CardTitle>Recent Signups</CardTitle>
              <CardDescription>New user registrations with attribution data</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <ScrollArea className="h-[400px]">
                {signupsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentSignups?.map((signup) => (
                      <SignupRow
                        key={signup.id}
                        signup={signup}
                        onClick={() => setSelectedUserId(
                          selectedUserId === signup.user_id ? null : signup.user_id
                        )}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedUserId && (
                <UserDrilldown
                  userId={selectedUserId}
                  onClose={() => setSelectedUserId(null)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage</CardTitle>
              <CardDescription>Most used features in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {featuresLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {featureStats?.map((stat) => (
                    <div key={stat.feature_category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium capitalize">{stat.feature_category}</div>
                          <div className="text-xs text-muted-foreground">
                            {stat.unique_users} unique users
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{stat.total_uses}</div>
                        <div className="text-xs text-muted-foreground">
                          ~{stat.avg_uses_per_user}/user
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle>User Cost Breakdown</CardTitle>
              <CardDescription>AI usage costs per user (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {costLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {costBreakdown?.map((user, index) => (
                      <div 
                        key={user.user_id} 
                        className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium truncate max-w-[200px]">{user.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.top_feature && <span className="capitalize">{user.top_feature}</span>}
                              {user.top_model && <span> • {user.top_model}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${Number(user.total_cost || 0).toFixed(4)}</div>
                          <div className="text-xs text-muted-foreground">
                            {Number(user.total_tokens || 0).toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
