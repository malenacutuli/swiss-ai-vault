import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Coins, MessageSquare, Database, Shield, 
  TrendingUp, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface GhostDashboardProps {
  onBuyCredits: () => void;
  totalConversations: number;
  totalMessages: number;
}

interface DailyUsage {
  day: string;
  tokens: number;
}

export function GhostDashboard({ onBuyCredits, totalConversations, totalMessages }: GhostDashboardProps) {
  const { user } = useAuth();
  const { balance, formattedBalance, isLoading: creditsLoading } = useGhostCredits();
  const [isOpen, setIsOpen] = useState(false);
  const [usageByDay, setUsageByDay] = useState<DailyUsage[]>([]);
  const [usageStats, setUsageStats] = useState({
    tokensUsedToday: 0,
    tokensUsedWeek: 0,
  });
  const [storageUsedMB, setStorageUsedMB] = useState(0);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadStats();
    }
  }, [isOpen, user]);

  const loadStats = async () => {
    setIsLoadingUsage(true);
    
    try {
      // Get usage from last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: usage } = await supabase
        .from('ghost_usage')
        .select('input_tokens, output_tokens, created_at')
        .eq('user_id', user?.id)
        .gte('created_at', weekAgo);

      // Calculate daily usage
      const dailyMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dailyMap.set(date.toLocaleDateString('en-US', { weekday: 'short' }), 0);
      }

      let todayTokens = 0;
      let weekTokens = 0;
      const today = new Date().toDateString();

      usage?.forEach(u => {
        const tokens = (u.input_tokens || 0) + (u.output_tokens || 0);
        const day = new Date(u.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        
        if (dailyMap.has(day)) {
          dailyMap.set(day, (dailyMap.get(day) || 0) + tokens);
        }
        
        weekTokens += tokens;
        
        if (new Date(u.created_at).toDateString() === today) {
          todayTokens += tokens;
        }
      });

      setUsageByDay(Array.from(dailyMap, ([day, tokens]) => ({ day, tokens })));
      setUsageStats({
        tokensUsedToday: todayTokens,
        tokensUsedWeek: weekTokens,
      });

      // Get local storage stats
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageUsedMB(Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100);
      }
    } catch (error) {
      console.error('[GhostDashboard] Error loading stats:', error);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toLocaleString();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto text-sm text-purple-300 hover:bg-purple-500/10"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Usage Dashboard</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-2 pb-3 space-y-3">
          {/* Credits Card */}
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Ghost Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {creditsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-white mb-2">
                    {formattedBalance}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                    <div>
                      <p className="text-purple-400">Today</p>
                      <p className="text-white">{formatTokens(usageStats.tokensUsedToday)}</p>
                    </div>
                    <div>
                      <p className="text-purple-400">This Week</p>
                      <p className="text-white">{formatTokens(usageStats.tokensUsedWeek)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={onBuyCredits}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Buy Credits
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Usage Chart */}
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Weekly Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-0">
              {isLoadingUsage ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                </div>
              ) : (
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageByDay}>
                      <XAxis 
                        dataKey="day" 
                        tick={{ fill: '#a78bfa', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e1b4b',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [formatTokens(value), 'Tokens']}
                      />
                      <Bar 
                        dataKey="tokens" 
                        fill="#a855f7" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Storage & Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="bg-slate-800/50 border-purple-500/20 p-3">
              <div className="flex flex-col items-center text-center">
                <Database className="w-5 h-5 text-purple-400 mb-1" />
                <p className="text-lg font-bold text-white">{storageUsedMB} MB</p>
                <p className="text-xs text-muted-foreground">Local Storage</p>
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-purple-500/20 p-3">
              <div className="flex flex-col items-center text-center">
                <MessageSquare className="w-5 h-5 text-purple-400 mb-1" />
                <p className="text-lg font-bold text-white">{totalMessages}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
            </Card>
          </div>

          {/* Security Status */}
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">Security Status</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Encryption</span>
                  <span className="text-green-400">AES-256-GCM ✓</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Server Logging</span>
                  <span className="text-green-400">Zero Content ✓</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Storage</span>
                  <span className="text-green-400">Local Only ✓</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
