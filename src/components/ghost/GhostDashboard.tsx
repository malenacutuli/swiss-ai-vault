import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, MessageSquare, HardDrive, Shield, 
  TrendingUp, ChevronDown, ChevronUp, Loader2, Check, Lock
} from '@/icons';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
          className="w-full justify-between px-4 py-3 h-auto text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Usage Dashboard</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-3 pb-4 space-y-3">
          {/* Credits Card */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="py-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-caps">
                <Sparkles className="w-4 h-4" />
                Ghost Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {creditsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="font-serif text-2xl font-semibold text-foreground mb-3">
                    {formattedBalance}
                  </p>
                  <div className="flex gap-6 text-xs text-muted-foreground mb-4">
                    <div>
                      <p className="uppercase tracking-caps text-[10px] mb-0.5">Today</p>
                      <p className="text-foreground font-medium">{formatTokens(usageStats.tokensUsedToday)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-caps text-[10px] mb-0.5">This Week</p>
                      <p className="text-foreground font-medium">{formatTokens(usageStats.tokensUsedWeek)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={onBuyCredits}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    Purchase Credits
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Usage Chart */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="py-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-caps">
                <TrendingUp className="w-4 h-4" />
                Weekly Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4 pt-0">
              {isLoadingUsage ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageByDay}>
                      <XAxis 
                        dataKey="day" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [formatTokens(value), 'Tokens']}
                      />
                      <Bar 
                        dataKey="tokens" 
                        radius={[4, 4, 0, 0]}
                      >
                        {usageByDay.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill="hsl(var(--swiss-navy))"
                            opacity={0.8}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Storage & Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="bg-muted/30 border-border p-4">
              <div className="flex flex-col items-center text-center">
                <HardDrive className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="font-serif text-lg font-semibold text-foreground">{storageUsedMB} MB</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-caps">Local Storage</p>
              </div>
            </Card>
            <Card className="bg-muted/30 border-border p-4">
              <div className="flex flex-col items-center text-center">
                <MessageSquare className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="font-serif text-lg font-semibold text-foreground">{totalMessages}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-caps">Messages</p>
              </div>
            </Card>
          </div>

          {/* Security Status */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-xs font-medium text-success uppercase tracking-caps">Security Status</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Encryption</span>
                  <span className="text-success flex items-center gap-1">
                    AES-256-GCM
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Server Logging</span>
                  <span className="text-success flex items-center gap-1">
                    Zero Content
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Storage</span>
                  <span className="text-success flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Local Only
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
