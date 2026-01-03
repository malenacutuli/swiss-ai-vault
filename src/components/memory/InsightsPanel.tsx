import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Lightbulb,
  Target,
  MessageSquare,
  FileText,
  Clock,
  Brain,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  ListChecks,
  Hash,
  Loader2,
  Play,
  Pause,
  Square,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInsights, type DistilledInsight } from '@/lib/memory/distill';
import { useDistillationRunner } from '@/hooks/useDistillationRunner';

interface InsightsPanelProps {
  totalItems: number;
  totalChats: number;
  totalDocuments: number;
  onDistill: (options?: { resume?: boolean }) => void;
}

export interface InsightsPanelRef {
  refresh: () => void;
}

export const InsightsPanel = forwardRef<InsightsPanelRef, InsightsPanelProps>(
  function InsightsPanel({
    totalItems,
    totalChats,
    totalDocuments,
    onDistill,
  }, ref) {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<DistilledInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedInsight, setSelectedInsight] = useState<DistilledInsight | null>(null);
  
  // Use the global distillation runner
  const {
    isRunning,
    isPaused,
    progress,
    remaining,
    total,
    succeeded,
    failed,
    rateLimited,
    estimatedMinutes,
    itemsPerSecond,
    hasResumable,
    resumableCount,
    config,
    pause,
    resume,
    stop,
  } = useDistillationRunner();

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInsights();
      setInsights(data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: loadInsights
  }), [loadInsights]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Aggregate stats from insights
  const allTopics = insights.flatMap(i => i.topics || []);
  const topicCounts = allTopics.reduce((acc, topic) => {
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const allActionItems = insights.flatMap(i => i.actionItems || []);
  const allDecisions = insights.flatMap(i => i.decisions || []);
  const allKeyPoints = insights.flatMap(i => i.keyPoints || []);

  const discoveryStats = {
    totalInsights: insights.length,
    topicsDiscovered: Object.keys(topicCounts).length,
    actionItems: allActionItems.length,
    decisions: allDecisions.length,
    keyPoints: allKeyPoints.length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('memory.insights.loading', 'Loading insights...')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold">{t('memory.insights.knowledgeBrain', 'Your Knowledge Brain')}</h2>
                  {isRunning && (
                    <Badge variant="secondary" className="animate-pulse">
                      {isPaused ? t('memory.insights.paused', 'Paused') : t('memory.insights.analyzing', 'Analyzing...')}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {isRunning 
                    ? `${remaining} ${t('memory.insights.itemsRemaining', 'items remaining')}`
                    : t('memory.insights.fromMemories', 'AI-powered insights from {{count}} memories').replace('{{count}}', totalItems.toLocaleString())}
                </p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    <strong>{totalChats}</strong>
                    <span className="text-muted-foreground">{t('memory.insights.chats', 'chats')}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <strong>{totalDocuments}</strong>
                    <span className="text-muted-foreground">{t('memory.insights.documents', 'documents')}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <strong>{discoveryStats.totalInsights}</strong>
                    <span className="text-muted-foreground">{t('memory.insights.title', 'insights')}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  {isPaused ? (
                    <Button onClick={resume} size="lg" variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      {t('memory.insights.resume', 'Resume')}
                    </Button>
                  ) : (
                    <Button onClick={pause} size="lg" variant="outline">
                      <Pause className="h-4 w-4 mr-2" />
                      {t('memory.insights.pause', 'Pause')}
                    </Button>
                  )}
                  <Button onClick={stop} size="icon" variant="ghost" className="text-muted-foreground">
                    <Square className="h-4 w-4" />
                  </Button>
                </>
              ) : hasResumable ? (
                <Button onClick={() => onDistill({ resume: true })} size="lg">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('memory.insights.resumeCount', 'Resume ({{count}})').replace('{{count}}', String(resumableCount))}
                </Button>
              ) : (
                <Button onClick={() => onDistill()} size="lg">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('memory.insights.discoverMore', 'Discover More')}
                </Button>
              )}
            </div>
          </div>
          
          {/* Progress bar when running */}
          {isRunning && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{remaining} of {total} remaining</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-600">✓ {succeeded}</span>
                  {failed > 0 && <span className="text-red-500">✗ {failed}</span>}
                  {rateLimited > 0 && <span className="text-amber-500">⏰ {rateLimited}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  {itemsPerSecond.toFixed(1)} items/sec • {config.concurrency} concurrent
                </span>
                {estimatedMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{estimatedMinutes} min remaining
                  </span>
                )}
              </div>
              {isPaused && (
                <p className="text-xs text-amber-600 text-center">{t('memory.insights.pausedHint', 'Paused - click Resume to continue')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === 'topics' && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab('topics')}
        >
          <CardContent className="p-4 text-center">
            <Hash className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{discoveryStats.topicsDiscovered}</p>
            <p className="text-xs text-muted-foreground">{t('memory.insights.topics', 'Topics')}</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === 'actions' && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab('actions')}
        >
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{discoveryStats.actionItems}</p>
            <p className="text-xs text-muted-foreground">{t('memory.insights.actions', 'Actions')}</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === 'decisions' && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab('decisions')}
        >
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{discoveryStats.decisions}</p>
            <p className="text-xs text-muted-foreground">{t('memory.insights.decisions', 'Decisions')}</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === 'keypoints' && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab('keypoints')}
        >
          <CardContent className="p-4 text-center">
            <ListChecks className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{discoveryStats.keyPoints}</p>
            <p className="text-xs text-muted-foreground">{t('memory.insights.keyPoints', 'Key Points')}</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === 'insights' && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab('insights')}
        >
          <CardContent className="p-4 text-center">
            <Lightbulb className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{discoveryStats.totalInsights}</p>
            <p className="text-xs text-muted-foreground">{t('memory.insights.title', 'Insights')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">{t('memory.insights.tabs.overview', 'Overview')}</TabsTrigger>
          <TabsTrigger value="topics">{t('memory.insights.tabs.topics', 'Topics')}</TabsTrigger>
          <TabsTrigger value="actions">{t('memory.insights.tabs.actions', 'Actions')}</TabsTrigger>
          <TabsTrigger value="insights">{t('memory.insights.tabs.allInsights', 'All Insights')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('memory.insights.tabs.timeline', 'Timeline')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top Topics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-500" />
                  {t('memory.insights.topTopics', 'Top Topics')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {topTopics.map(([topic, count]) => (
                    <Badge key={topic} variant="secondary" className="text-sm">
                      {topic}
                      <span className="ml-1 text-muted-foreground">({count})</span>
                    </Badge>
                    ))}
                    {topTopics.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t('memory.insights.noTopicsYet', 'No topics discovered yet. Run "Discover More" to analyze your content.')}
                      </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Action Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-red-500" />
                  {t('memory.insights.recentActions', 'Recent Action Items')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allActionItems.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                      <span className="line-clamp-2">{item}</span>
                    </div>
                    ))}
                    {allActionItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t('memory.insights.noActionsYet', 'No action items found yet.')}</p>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('memory.insights.recentDiscoveries', 'Recent Discoveries')}</CardTitle>
              <CardDescription>{t('memory.insights.latestInsights', 'Latest insights extracted from your conversations')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.slice(0, 3).map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedInsight(insight);
                      setActiveTab('insights');
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{insight.title || t('memory.insights.untitled', 'Untitled Insight')}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {insight.summary}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                          {insight.topics?.slice(0, 3).map(topic => (
                            <Badge key={topic} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
                {insights.length === 0 && (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-medium">{t('memory.insights.noInsights')}</p>
                    <p className="text-sm text-muted-foreground">{t('memory.insights.clickDiscover', 'Click "Discover More" to analyze your content')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                {t('memory.insights.allTopics', 'All Topics')} ({Object.keys(topicCounts).length})
              </CardTitle>
              <CardDescription>{t('memory.insights.topicsDesc', 'Topics discovered across all your conversations and documents')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(topicCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([topic, count]) => (
                    <Badge key={topic} variant="secondary" className="text-sm py-1.5 px-3">
                      {topic}
                      <span className="ml-1.5 text-muted-foreground">×{count}</span>
                    </Badge>
                    ))}
                {Object.keys(topicCounts).length === 0 && (
                  <p className="text-muted-foreground">{t('memory.insights.noTopicsDiscovered', 'No topics discovered yet.')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Action Items ({allActionItems.length})
              </CardTitle>
              <CardDescription>Tasks and action items extracted from your content</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {allActionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <div className="h-2 w-2 rounded-full bg-red-500 mt-2 shrink-0" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                  {allActionItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No action items found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Decisions ({allDecisions.length})
              </CardTitle>
              <CardDescription>Key decisions made across your conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {allDecisions.map((decision, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{decision}</span>
                    </div>
                  ))}
                  {allDecisions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No decisions found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Key Points Tab */}
        <TabsContent value="keypoints">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Key Points ({allKeyPoints.length})
              </CardTitle>
              <CardDescription>Important points extracted from your conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {allKeyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <span className="text-sm">{point}</span>
                    </div>
                  ))}
                  {allKeyPoints.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No key points found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                All Insights ({insights.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={cn(
                        "p-4 rounded-lg border transition-colors cursor-pointer",
                        selectedInsight?.id === insight.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedInsight(
                        selectedInsight?.id === insight.id ? null : insight
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{insight.title || 'Untitled'}</p>
                            <Badge variant="outline" className="text-xs capitalize">
                              {insight.sourceType || 'chat'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {insight.summary}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {selectedInsight?.id === insight.id && (
                        <div className="mt-4 space-y-4 pt-4 border-t border-border">
                          {insight.keyPoints?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <ListChecks className="h-3 w-3" />
                                Key Points
                              </p>
                              <ul className="space-y-1">
                                {insight.keyPoints.map((point, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {insight.actionItems?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                Action Items
                              </p>
                              <ul className="space-y-1">
                                {insight.actionItems.map((item, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {insight.decisions?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Decisions
                              </p>
                              <ul className="space-y-1">
                                {insight.decisions.map((decision, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <CheckCircle2 className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                                    {decision}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {insight.topics?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {insight.topics.map(topic => (
                                <Badge key={topic} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <div className="text-center py-8">
                      <Lightbulb className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="font-medium">No insights yet</p>
                      <p className="text-sm text-muted-foreground">Click "Discover More" to analyze your content</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Discovery Timeline
              </CardTitle>
              <CardDescription>Your knowledge discoveries over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="relative pl-6 pr-4">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {insights.map((insight) => (
                      <div key={insight.id} className="relative">
                        <div className="absolute -left-4 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="p-4 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-1">
                            {new Date(insight.createdAt).toLocaleString()}
                          </p>
                          <p className="font-medium">{insight.title || 'Insight'}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {insight.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                    {insights.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No insights in timeline
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});
