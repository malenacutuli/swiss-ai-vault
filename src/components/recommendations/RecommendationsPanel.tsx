import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  TrendingUp,
  Target,
  Sparkles,
  Search,
  ChevronRight,
  BookOpen,
  Globe,
  Building2,
  GraduationCap,
  AlertTriangle,
  Loader2,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  buildResearchProfile,
  generateRecommendations,
  generateTopicSuggestions,
  analyzeResearchGaps,
  getPersonalizedSearchSuggestions,
  type SourceRecommendation,
  type TopicSuggestion,
  type ResearchGap,
  type UserResearchProfile
} from '@/lib/recommendations/source-recommender';

interface RecommendationsPanelProps {
  sources: Array<{
    id: string;
    title: string;
    domain: string;
    trustScore: number;
    savedAt: number;
    tags?: string[];
    isGovernment?: boolean;
    isAcademic?: boolean;
    isPeerReviewed?: boolean;
  }>;
  sessions: Array<{
    id: string;
    query: string;
    createdAt: number;
    sources: string[];
  }>;
  onSearch?: (query: string) => void;
  compact?: boolean;
}

export function RecommendationsPanel({
  sources,
  sessions,
  onSearch,
  compact = false
}: RecommendationsPanelProps) {
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<UserResearchProfile | null>(null);
  const [recommendations, setRecommendations] = useState<SourceRecommendation[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[]>([]);
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      const researchProfile = buildResearchProfile(sources, sessions);
      setProfile(researchProfile);
      
      const recs = generateRecommendations(researchProfile, sources);
      setRecommendations(recs);
      
      const topics = generateTopicSuggestions(researchProfile);
      setTopicSuggestions(topics);
      
      const researchGaps = analyzeResearchGaps(researchProfile, sources);
      setGaps(researchGaps);
      
      const searches = getPersonalizedSearchSuggestions(researchProfile);
      setSearchSuggestions(searches);
      
      setIsLoading(false);
    }, 500);
  }, [sources, sessions]);
  
  const handleSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
    } else {
      navigate(`/ghost?q=${encodeURIComponent(query)}`);
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Analyzing your research patterns...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (sources.length === 0 && sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="font-medium">No Recommendations Yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Start researching and saving sources to get personalized recommendations.
          </p>
          <Button onClick={() => navigate('/ghost')}>
            <Search className="h-4 w-4 mr-2" />
            Start Research
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recommendations.slice(0, 3).map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onSearch={handleSearch}
              compact
            />
          ))}
          
          {recommendations.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate('/ghost/research-library?tab=recommendations')}
            >
              View All Recommendations
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Your Research Profile
            </CardTitle>
            <CardDescription>
              Based on {sources.length} sources and {sessions.length} sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Top Topics</p>
                <div className="flex flex-wrap gap-1">
                  {profile.topics.slice(0, 3).map(topic => (
                    <Badge key={topic.name} variant="secondary" className="text-xs">
                      {topic.name.replace('-', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2">Source Mix</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="h-3 w-3" />
                    {profile.sourcePreferences.government.toFixed(0)}% Gov
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <GraduationCap className="h-3 w-3" />
                    {profile.sourcePreferences.academic.toFixed(0)}% Academic
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2">Research Pace</p>
                <Badge variant="outline">
                  {profile.patterns.researchFrequency}
                </Badge>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2">Knowledge Gaps</p>
                <Badge variant={gaps.length > 2 ? 'destructive' : gaps.length > 0 ? 'outline' : 'secondary'}>
                  {gaps.length} identified
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="recommendations">
        <TabsList>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Recommendations
            {recommendations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{recommendations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Topics to Explore
          </TabsTrigger>
          <TabsTrigger value="gaps" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Knowledge Gaps
            {gaps.filter(g => g.importance === 'high').length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {gaps.filter(g => g.importance === 'high').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="recommendations" className="mt-4">
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onSearch={handleSearch}
              />
            ))}
            
            {recommendations.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Save more sources to get personalized recommendations
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="topics" className="mt-4">
          <div className="space-y-3">
            {topicSuggestions.map((suggestion, i) => (
              <TopicSuggestionCard
                key={i}
                suggestion={suggestion}
                onSearch={handleSearch}
              />
            ))}
            
            {topicSuggestions.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Research more topics to get exploration suggestions
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="gaps" className="mt-4">
          <div className="space-y-3">
            {gaps.map((gap, i) => (
              <GapCard
                key={i}
                gap={gap}
                onSearch={handleSearch}
              />
            ))}
            
            {gaps.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">No Significant Gaps Detected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your research coverage looks comprehensive
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {searchSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Suggested Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {searchSuggestions.slice(0, 8).map((query, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleSearch(query)}
                >
                  {query}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecommendationCard({
  recommendation,
  onSearch,
  compact = false
}: {
  recommendation: SourceRecommendation;
  onSearch: (query: string) => void;
  compact?: boolean;
}) {
  const getTypeIcon = () => {
    switch (recommendation.type) {
      case 'related': return <TrendingUp className="h-4 w-4" />;
      case 'higher-quality': return <Sparkles className="h-4 w-4" />;
      case 'gap-fill': return <Target className="h-4 w-4" />;
      case 'trending': return <TrendingUp className="h-4 w-4" />;
      case 'deep-dive': return <BookOpen className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };
  
  const getTypeColor = () => {
    switch (recommendation.type) {
      case 'related': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'higher-quality': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'gap-fill': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      case 'trending': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      case 'deep-dive': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };
  
  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onSearch(recommendation.suggestedQuery)}
      >
        <div className={cn('p-1.5 rounded', getTypeColor())}>
          {getTypeIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{recommendation.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {recommendation.basedOn}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className={cn('p-2 rounded-lg h-fit', getTypeColor())}>
            {getTypeIcon()}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{recommendation.title}</p>
                <p className="text-sm text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>
              
              <Badge variant="secondary">
                {recommendation.relevanceScore}% match
              </Badge>
            </div>
            
            {recommendation.domains && recommendation.domains.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Suggested sources:
                <div className="flex flex-wrap gap-1 mt-1">
                  {recommendation.domains.slice(0, 3).map(domain => (
                    <Badge key={domain} variant="outline" className="text-xs">
                      {domain}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => onSearch(recommendation.suggestedQuery)}>
                <Search className="h-3 w-3 mr-2" />
                Search Now
              </Button>
              <span className="text-xs text-muted-foreground">
                Based on: {recommendation.basedOn}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicSuggestionCard({
  suggestion,
  onSearch
}: {
  suggestion: TopicSuggestion;
  onSearch: (query: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {suggestion.topic}
        </CardTitle>
        <CardDescription>{suggestion.reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Related to: {suggestion.relatedToExisting.join(', ')}
        </p>
        
        <div className="flex flex-wrap gap-2">
          {suggestion.searchQueries.slice(0, 3).map((query, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onSearch(query)}
            >
              <Search className="h-3 w-3 mr-1" />
              {query}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GapCard({
  gap,
  onSearch
}: {
  gap: ResearchGap;
  onSearch: (query: string) => void;
}) {
  const getCoverageColor = () => {
    switch (gap.currentCoverage) {
      case 'none': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'minimal': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      case 'partial': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className={cn('p-2 rounded-lg h-fit', getCoverageColor())}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{gap.topic}</p>
                <p className="text-sm text-muted-foreground">
                  {gap.description}
                </p>
              </div>
              
              <Badge variant={gap.importance === 'high' ? 'destructive' : 'secondary'}>
                {gap.importance}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Coverage:</span>
              <Progress value={gap.currentCoverage === 'none' ? 0 : gap.currentCoverage === 'minimal' ? 25 : 50} className="w-20 h-1.5" />
              <span className={cn('capitalize', getCoverageColor().split(' ')[0])}>
                {gap.currentCoverage}
              </span>
            </div>
            
            <div>
              <p className="text-xs font-medium mb-1">Suggested Actions:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {gap.suggestedActions.slice(0, 2).map((action, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {gap.suggestedSearches.slice(0, 2).map((query, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => onSearch(query)}
                >
                  <Search className="h-3 w-3 mr-1" />
                  {query.length > 25 ? query.slice(0, 25) + '...' : query}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
