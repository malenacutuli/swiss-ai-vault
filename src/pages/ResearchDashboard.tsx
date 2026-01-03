// src/pages/ResearchDashboard.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  BookOpen,
  Calendar,
  Tag,
  Folder,
  ExternalLink,
  Trash2,
  MoreVertical,
  Plus,
  Filter,
  SortAsc,
  SortDesc,
  FileText,
  Globe,
  Building2,
  GraduationCap,
  Clock,
  TrendingUp,
  BookmarkCheck,
  ChevronRight,
  Download,
  Brain,
  Loader2,
  Lock,
  Lightbulb,
  ArrowLeft
} from 'lucide-react';
import { RecommendationsPanel } from '@/components/recommendations/RecommendationsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { EncryptionSetupWizard } from '@/components/vault/EncryptionSetupWizard';
import { useMemory } from '@/hooks/useMemory';
import { 
  getResearchSessions, 
  deleteResearchSession,
  ResearchSession 
} from '@/lib/memory/source-to-memory';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';
import { cn } from '@/lib/utils';

interface SavedSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  trustScore: number;
  tierLabel: string;
  savedAt: number;
  tags?: string[];
  userNotes?: string;
  accessCount: number;
  isGovernment?: boolean;
  isAcademic?: boolean;
  isPeerReviewed?: boolean;
}

interface ResearchStats {
  totalSessions: number;
  totalSources: number;
  sourcesThisMonth: number;
  topDomains: { domain: string; count: number }[];
  averageTrustScore: number;
  sourcesByTier: { tier: string; count: number }[];
}

export default function ResearchDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isUnlocked, isInitialized, isLoading: encryptionLoading } = useEncryptionContext();
  const memory = useMemory();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // State
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [sources, setSources] = useState<SavedSource[]>([]);
  const [stats, setStats] = useState<ResearchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'trust' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterTier, setFilterTier] = useState('all');
  const [selectedSession, setSelectedSession] = useState<ResearchSession | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'session' | 'source'; id: string } | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  
  // Detect first-time users who need encryption setup
  useEffect(() => {
    if (!encryptionLoading && !isInitialized) {
      setShowSetupWizard(true);
    }
  }, [encryptionLoading, isInitialized]);
  
  // Load data
  useEffect(() => {
    if (isUnlocked) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isUnlocked]);
  
  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    loadData();
  };
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load sessions from localStorage
      const loadedSessions = getResearchSessions();
      setSessions(loadedSessions);
      
      // For now, simulate sources - in production, query memory store
      const simulatedSources: SavedSource[] = [];
      setSources(simulatedSources);
      
      // Calculate stats
      const statsData: ResearchStats = {
        totalSessions: loadedSessions.length,
        totalSources: simulatedSources.length,
        sourcesThisMonth: simulatedSources.filter(
          s => s.savedAt > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length,
        topDomains: calculateTopDomains(simulatedSources),
        averageTrustScore: simulatedSources.length > 0
          ? simulatedSources.reduce((sum, s) => sum + s.trustScore, 0) / simulatedSources.length
          : 0,
        sourcesByTier: calculateSourcesByTier(simulatedSources)
      };
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load research data:', error);
      toast({
        title: 'Failed to load data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const calculateTopDomains = (sources: SavedSource[]) => {
    const domainCounts: Record<string, number> = {};
    sources.forEach(s => {
      domainCounts[s.domain] = (domainCounts[s.domain] || 0) + 1;
    });
    return Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };
  
  const calculateSourcesByTier = (sources: SavedSource[]) => {
    const tierCounts: Record<string, number> = {};
    sources.forEach(s => {
      tierCounts[s.tierLabel] = (tierCounts[s.tierLabel] || 0) + 1;
    });
    return Object.entries(tierCounts)
      .map(([tier, count]) => ({ tier, count }));
  };
  
  // Filter and sort sources
  const filteredSources = sources
    .filter(s => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(query) ||
               s.domain.toLowerCase().includes(query) ||
               s.tags?.some(t => t.toLowerCase().includes(query));
      }
      return true;
    })
    .filter(s => {
      if (filterTier === 'all') return true;
      if (filterTier === 'authoritative') return s.isGovernment || s.isAcademic;
      if (filterTier === 'government') return s.isGovernment;
      if (filterTier === 'academic') return s.isAcademic;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.savedAt - b.savedAt;
          break;
        case 'trust':
          comparison = a.trustScore - b.trustScore;
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  
  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      if (deleteConfirm.type === 'session') {
        deleteResearchSession(deleteConfirm.id);
        setSessions(sessions.filter(s => s.id !== deleteConfirm.id));
        toast({ title: 'Session deleted' });
      } else {
        // Delete source from memory
        await memory.deleteItem(deleteConfirm.id);
        setSources(sources.filter(s => s.id !== deleteConfirm.id));
        toast({ title: 'Source removed from memory' });
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        variant: 'destructive'
      });
    } finally {
      setDeleteConfirm(null);
    }
  };
  
  // Export research data
  const handleExport = async () => {
    try {
      const exportData = {
        version: 1,
        exportedAt: Date.now(),
        sessions,
        sources
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swissvault-research-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Research data exported' });
    } catch (error) {
      toast({
        title: 'Export failed',
        variant: 'destructive'
      });
    }
  };
  
  // Show setup wizard for first-time users
  if (showSetupWizard && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <EncryptionSetupWizard 
          onComplete={handleSetupComplete}
          onSkip={() => {
            setShowSetupWizard(false);
            navigate('/ghost/chat');
          }}
        />
      </div>
    );
  }
  
  // Show unlock dialog for returning users
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{t('researchLibrary.title', 'Research Library')}</CardTitle>
            <CardDescription>
              {t('researchLibrary.unlockDesc', 'Unlock your vault to access your saved research')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowUnlock(true)} className="w-full">
              {t('vault.unlock.title', 'Unlock Vault')}
            </Button>
          </CardContent>
        </Card>
        
        <VaultUnlockDialog
          open={showUnlock}
          onOpenChange={setShowUnlock}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back to Chat */}
      <div className="container max-w-6xl mx-auto px-4 pt-6">
        <button 
          onClick={() => navigate('/ghost')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('projects.backToChat', 'Back to Chat')}
        </button>
      </div>
      
      {/* Header */}
      <div className="border-b border-border bg-card mt-4">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{t('researchLibrary.title', 'Research Library')}</h1>
                <p className="text-sm text-muted-foreground">{t('researchLibrary.subtitle', 'Your curated knowledge base')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                {t('researchLibrary.actions.export', 'Export')}
              </Button>
              <Button size="sm" onClick={() => navigate('/ghost')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('researchLibrary.newResearch', 'New Research')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('researchLibrary.stats.totalSources', 'Total Sources')}</p>
                    <p className="text-2xl font-semibold">{stats.totalSources}</p>
                  </div>
                  <BookmarkCheck className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('researchLibrary.stats.thisMonth', 'This Month')}</p>
                    <p className="text-2xl font-semibold">{stats.sourcesThisMonth}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('researchLibrary.stats.avgTrustScore', 'Avg Trust Score')}</p>
                    <p className="text-2xl font-semibold">{stats.averageTrustScore.toFixed(0)}%</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('researchLibrary.stats.sessions', 'Sessions')}</p>
                    <p className="text-2xl font-semibold">{stats.totalSessions}</p>
                  </div>
                  <Folder className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Main Content */}
        <Tabs defaultValue="sources" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sources" className="gap-2">
              <Globe className="h-4 w-4" />
              {t('researchLibrary.tabs.savedSources', 'Saved Sources')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Folder className="h-4 w-4" />
              {t('researchLibrary.tabs.researchSessions', 'Research Sessions')}
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('researchLibrary.tabs.insights', 'Insights')}
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              {t('researchLibrary.tabs.recommendations', 'Smart Recommendations')}
            </TabsTrigger>
          </TabsList>
          
          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('researchLibrary.searchPlaceholder', 'Search sources...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={filterTier} onValueChange={setFilterTier}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('researchLibrary.filters.allSources', 'All Sources')}</SelectItem>
                    <SelectItem value="authoritative">{t('researchLibrary.filters.authoritative', 'Authoritative')}</SelectItem>
                    <SelectItem value="government">{t('researchLibrary.filters.government', 'Government')}</SelectItem>
                    <SelectItem value="academic">{t('researchLibrary.filters.academic', 'Academic')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'trust' | 'name')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">{t('researchLibrary.sort.dateSaved', 'Date Saved')}</SelectItem>
                    <SelectItem value="trust">{t('researchLibrary.sort.trustScore', 'Trust Score')}</SelectItem>
                    <SelectItem value="name">{t('researchLibrary.sort.name', 'Name')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Sources List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSources.length === 0 ? (
              <EmptySourcesState onStartResearch={() => navigate('/ghost')} />
            ) : (
              <div className="space-y-3">
                {filteredSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onDelete={() => setDeleteConfirm({ type: 'source', id: source.id })}
                    onOpen={() => window.open(source.url, '_blank')}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            {sessions.length === 0 ? (
              <EmptySessionsState onStartResearch={() => navigate('/ghost')} />
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onSelect={() => setSelectedSession(session)}
                    onDelete={() => setDeleteConfirm({ type: 'session', id: session.id })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Insights Tab */}
          <TabsContent value="insights">
            <InsightsPanel stats={stats} sources={sources} sessions={sessions} />
          </TabsContent>
          
          {/* Recommendations Tab */}
          <TabsContent value="recommendations">
            <RecommendationsPanel
              sources={sources.map(s => ({
                ...s,
                savedAt: s.savedAt
              }))}
              sessions={sessions.map(s => ({
                id: s.id,
                query: s.query,
                createdAt: s.createdAt,
                sources: s.sources
              }))}
              onSearch={(query) => navigate(`/ghost?q=${encodeURIComponent(query)}`)}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Session Detail Dialog */}
      <SessionDetailDialog
        session={selectedSession}
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
        sources={sources}
      />
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === 'session' 
                ? t('researchLibrary.deleteSession', 'Delete session?')
                : t('researchLibrary.deleteSource', 'Delete source?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'session'
                ? t('researchLibrary.deleteSessionDesc', 'This will delete the research session. Saved sources will remain in your memory.')
                : t('researchLibrary.deleteSourceDesc', 'This will remove the source from your memory. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Source Card Component
function SourceCard({
  source,
  onDelete,
  onOpen
}: {
  source: SavedSource;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const getTierIcon = () => {
    if (source.isGovernment) return <Building2 className="h-4 w-4" />;
    if (source.isAcademic) return <GraduationCap className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };
  
  const getTierColor = () => {
    if (source.isGovernment || source.isAcademic) return 'text-green-600';
    if (source.trustScore >= 60) return 'text-blue-600';
    return 'text-muted-foreground';
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", getTierColor(), "bg-current/10")}>
            <span className={getTierColor()}>
              {getTierIcon()}
            </span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground truncate">{source.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{source.domain}</p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onOpen}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t('researchLibrary.openUrl', 'Open URL')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/ghost/memory?highlight=${source.id}`)}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('researchLibrary.viewInMemory', 'View in Memory')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('researchLibrary.remove', 'Remove')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Metadata */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {source.tierLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {source.trustScore}% {t('researchLibrary.trust', 'trust')}
              </Badge>
              {source.isPeerReviewed && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                  {t('researchLibrary.peerReviewed', 'Peer Reviewed')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(source.savedAt).toLocaleDateString()}
              </span>
            </div>
            
            {/* Tags */}
            {source.tags && source.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {source.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {source.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{source.tags.length - 3} {t('common.more', 'more')}
                  </span>
                )}
              </div>
            )}
            
            {/* User notes preview */}
            {source.userNotes && (
              <p className="text-sm text-muted-foreground mt-2 italic line-clamp-1">
                "{source.userNotes}"
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Session Card Component
function SessionCard({
  session,
  onSelect,
  onDelete
}: {
  session: ResearchSession;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  
  return (
    <Card 
      className="hover:border-primary/30 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">{session.name}</h3>
            <p className="text-sm text-muted-foreground truncate mt-1">
              "{session.query}"
            </p>
            
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookmarkCheck className="h-3 w-3" />
                {session.sources.length} {t('researchLibrary.sources', 'sources')}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            {session.tags && session.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {session.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Session Detail Dialog
function SessionDetailDialog({
  session,
  open,
  onOpenChange,
  sources
}: {
  session: ResearchSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: SavedSource[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  if (!session) return null;
  
  const sessionSources = sources.filter(s => session.sources.includes(s.id));
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{session.name}</DialogTitle>
          <DialogDescription>
            {t('researchLibrary.sessionFrom', 'Research session from {{date}}').replace('{{date}}', new Date(session.createdAt).toLocaleDateString())}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-auto flex-1">
          {/* Query */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('researchLibrary.originalQuery', 'Original Query')}</h4>
            <p className="text-foreground">"{session.query}"</p>
          </div>
          
          {/* Notes */}
          {session.notes && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('researchLibrary.notes', 'Notes')}</h4>
              <p className="text-foreground">{session.notes}</p>
            </div>
          )}
          
          {/* Sources */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {t('researchLibrary.tabs.sources', 'Sources')} ({sessionSources.length})
            </h4>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {sessionSources.map(source => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{source.title}</p>
                        <p className="text-sm text-muted-foreground">{source.domain}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {source.trustScore}%
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {source.tierLabel}
                          </Badge>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </a>
                ))}
                
                {sessionSources.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('researchLibrary.noSourcesForSession', 'No sources found for this session')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('researchLibrary.close', 'Close')}
          </Button>
          <Button onClick={() => {
            navigate('/ghost');
            onOpenChange(false);
          }}>
            {t('researchLibrary.continueResearch', 'Continue Research')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Insights Panel
function InsightsPanel({
  stats,
  sources,
  sessions
}: {
  stats: ResearchStats | null;
  sources: SavedSource[];
  sessions: ResearchSession[];
}) {
  const { t } = useTranslation();
  
  if (!stats) return null;
  
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Source Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('researchLibrary.sourceDistribution', 'Source Distribution')}</CardTitle>
          <CardDescription>{t('researchLibrary.byTrustTier', 'By trust tier')}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.sourcesByTier.length > 0 ? (
            <div className="space-y-3">
              {stats.sourcesByTier.map(({ tier, count }) => (
                <div key={tier}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{tier}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Progress value={(count / stats.totalSources) * 100} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('researchLibrary.noSourcesYet', 'No sources yet')}</p>
          )}
        </CardContent>
      </Card>
      
      {/* Top Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('researchLibrary.topDomains', 'Top Domains')}</CardTitle>
          <CardDescription>{t('researchLibrary.mostSavedFrom', 'Most saved sources from')}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topDomains.length > 0 ? (
            <div className="space-y-2">
              {stats.topDomains.map(({ domain, count }, i) => (
                <div key={domain} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{domain}</span>
                  </div>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('researchLibrary.noSourcesYet', 'No sources yet')}</p>
          )}
        </CardContent>
      </Card>
      
      {/* Research Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('researchLibrary.researchActivity', 'Research Activity')}</CardTitle>
          <CardDescription>{t('researchLibrary.knowledgeGrowth', 'Your knowledge growth')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('researchLibrary.totalSources', 'Total Sources')}</span>
              <span className="font-medium">{stats.totalSources}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('researchLibrary.addedThisMonth', 'Added This Month')}</span>
              <span className="font-medium text-green-600">
                +{stats.sourcesThisMonth}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('researchLibrary.researchSessions', 'Research Sessions')}</span>
              <span className="font-medium">{stats.totalSessions}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Quality Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('researchLibrary.knowledgeQuality', 'Knowledge Quality')}</CardTitle>
          <CardDescription>{t('researchLibrary.basedOnAuthority', 'Based on source authority')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-3">
              <span className="text-2xl font-bold text-primary">
                {stats.averageTrustScore.toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('researchLibrary.avgTrustDesc', 'Average trust score across all sources')}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <Badge variant="outline" className="text-xs">
                {sources.filter(s => s.isGovernment).length} {t('researchLibrary.gov', 'gov')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {sources.filter(s => s.isAcademic).length} {t('researchLibrary.academic', 'academic')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {sources.filter(s => s.isPeerReviewed).length} {t('researchLibrary.peerReviewed', 'peer-reviewed')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Empty States
function EmptySourcesState({ onStartResearch }: { onStartResearch: () => void }) {
  const { t } = useTranslation();
  
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">{t('researchLibrary.emptySourcesTitle', 'No saved sources yet')}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {t('researchLibrary.emptySourcesDesc', 'Start a research session and save authoritative sources to build your personal knowledge base.')}
        </p>
        <Button onClick={onStartResearch}>
          <Plus className="h-4 w-4 mr-2" />
          {t('researchLibrary.startResearch', 'Start Research')}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptySessionsState({ onStartResearch }: { onStartResearch: () => void }) {
  const { t } = useTranslation();
  
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">{t('researchLibrary.emptySessionsTitle', 'No research sessions')}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {t('researchLibrary.emptySessionsDesc', 'Research sessions help you organize and revisit related sources from your investigations.')}
        </p>
        <Button onClick={onStartResearch}>
          <Plus className="h-4 w-4 mr-2" />
          {t('researchLibrary.newSession', 'New Research Session')}
        </Button>
      </CardContent>
    </Card>
  );
}
