import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { useHealthStorage } from '@/hooks/useHealthStorage';
import {
  Heart,
  Stethoscope,
  FlaskConical,
  Shield,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search,
  Zap,
  Mic,
  UserRound,
  FolderOpen,
  Upload,
  Brain,
} from 'lucide-react';

// Lazy load components
const HealthVoiceChat = lazy(() => 
  import('@/components/ghost/health/HealthVoiceChat').then(m => ({ default: m.HealthVoiceChat }))
);
const HumanProfessionalModal = lazy(() => 
  import('@/components/ghost/health/HumanProfessionalModal').then(m => ({ default: m.HumanProfessionalModal }))
);
const HealthSessionPanel = lazy(() => 
  import('@/components/ghost/health/HealthSessionPanel').then(m => ({ default: m.HealthSessionPanel }))
);
const HealthImageUpload = lazy(() => 
  import('@/components/ghost/health/HealthImageUpload').then(m => ({ default: m.HealthImageUpload }))
);
const HealthConsultChat = lazy(() => 
  import('@/components/ghost/health/HealthConsultChat').then(m => ({ default: m.HealthConsultChat }))
);
import { cn } from '@/lib/utils';

interface Citation {
  index: number;
  url: string;
  domain: string;
}

interface SearchResult {
  content: string;
  citations: Citation[];
}

type ActionType = 'conditions' | 'treatments' | 'trials';

const HEALTH_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.cardiology', 
    gradientFrom: '#7f1d1d', 
    gradientTo: '#991b1b',
    image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.oncology', 
    gradientFrom: '#581c87', 
    gradientTo: '#7c3aed',
    image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.neurology', 
    gradientFrom: '#1e3a8a', 
    gradientTo: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.longevity', 
    gradientFrom: '#065f46', 
    gradientTo: '#10b981',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.mentalHealth', 
    gradientFrom: '#0e7490', 
    gradientTo: '#22d3ee',
    image: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.preventive', 
    gradientFrom: '#166534', 
    gradientTo: '#22c55e',
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop'
  },
];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    conditions: [
      'ghost.modules.health.suggestions.conditions.1',
      'ghost.modules.health.suggestions.conditions.2',
      'ghost.modules.health.suggestions.conditions.3',
    ],
    treatments: [
      'ghost.modules.health.suggestions.treatments.1',
      'ghost.modules.health.suggestions.treatments.2',
      'ghost.modules.health.suggestions.treatments.3',
    ],
    trials: [
      'ghost.modules.health.suggestions.trials.1',
      'ghost.modules.health.suggestions.trials.2',
      'ghost.modules.health.suggestions.trials.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostHealth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [activeAction, setActiveAction] = useState<ActionType>('conditions');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showConsult, setShowConsult] = useState(false);
  const searchCardRef = useRef<HTMLDivElement>(null);
  
  // Health storage hook for local session management
  const { conversations, deleteConversation, isLoading: healthStorageLoading } = useHealthStorage();

  const suggestionKeys = useMemo(
    () => getSuggestionKeys(activeAction),
    [activeAction]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchCardRef.current && !searchCardRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { 
          module: 'health', 
          query,
          mode: searchMode,
          action: activeAction,
          language: i18n.language
        },
      });
      
      if (error) throw error;
      setResult(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleActionClick = (action: ActionType) => {
    setActiveAction(action);
    setQuery('');
    setResult(null);
    setShowSuggestions(true);
  };

  return (
    <DiscoverLayout activeModule="health">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <Heart className="w-8 h-8 mx-auto text-[#2A8C86]" strokeWidth={1.5} />
            <h1 className="text-2xl font-semibold text-slate-900">{t('ghost.modules.health.title')}</h1>
            <p className="text-slate-500">{t('ghost.modules.health.subtitle')}</p>
          </div>

          {/* Privacy Notice */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                {t('ghost.modules.health.privacyNotice', 'Your health queries are encrypted and never stored')}
              </span>
            </div>
          </div>

          {/* Search Card */}
          <Card ref={searchCardRef} className="p-4 bg-white shadow-sm border-slate-200/60 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
                <SourcesDropdown module="health" />
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(e.target.value.length === 0);
                }}
                onFocus={() => !query && setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('ghost.modules.health.placeholder')}
                className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#2A8C86] text-white rounded-lg hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
              
              {showSuggestions && !query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden">
                  <p className="px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50">
                    {t('ghost.search.getStarted')} {t(`ghost.modules.health.actions.${activeAction}`)}
                  </p>
                  {suggestionKeys.map((key, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(t(key));
                        setShowSuggestions(false);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                    >
                      <Search className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                      {t(key)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Action Buttons - Reorganized */}
          <div className="flex flex-wrap justify-center gap-2">
            {/* Research Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('conditions')}
              className={cn(
                "gap-2 rounded-full border-slate-200 transition-all",
                activeAction === 'conditions' 
                  ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Stethoscope className="w-4 h-4" />
              {t('ghost.modules.health.actions.conditions')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('treatments')}
              className={cn(
                "gap-2 rounded-full border-slate-200 transition-all",
                activeAction === 'treatments' 
                  ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Heart className="w-4 h-4" />
              {t('ghost.modules.health.actions.treatments')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('trials')}
              className={cn(
                "gap-2 rounded-full border-slate-200 transition-all",
                activeAction === 'trials'
                  ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <FlaskConical className="w-4 h-4" />
              {t('ghost.modules.health.actions.trials')}
            </Button>
            
            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />
            
            {/* AI Agent Button - Voice */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAvatar(true)}
              className="gap-2 rounded-full border-[#2A8C86] bg-[#2A8C86]/5 text-[#2A8C86] hover:bg-[#2A8C86]/15 transition-all font-medium"
            >
              <Mic className="w-4 h-4" />
              {t('ghost.health.avatar.talkToAgent', 'Talk to Healthcare AI Agent')}
            </Button>

            {/* Health Consult - Navigate to /health */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/health')}
              className="gap-2 rounded-full border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all font-medium"
            >
              <Brain className="w-4 h-4" />
              {t('ghost.health.consult.button', 'Health Consult')}
            </Button>
            
            {/* Request Human Professional */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHumanModal(true)}
              className="gap-2 rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-all"
            >
              <UserRound className="w-4 h-4" />
              {t('ghost.health.humanProfessional.button', 'Request Human Professional')}
            </Button>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />
            
            {/* Sessions & Upload */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSessions(!showSessions)}
              className={cn(
                "gap-2 rounded-full transition-all",
                showSessions ? "bg-slate-100 text-slate-800" : "text-slate-600"
              )}
            >
              <FolderOpen className="w-4 h-4" />
              {t('ghost.health.sessions.button', 'My Sessions')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
              className={cn(
                "gap-2 rounded-full transition-all",
                showUpload ? "bg-slate-100 text-slate-800" : "text-slate-600"
              )}
            >
              <Upload className="w-4 h-4" />
              {t('ghost.health.upload.button', 'Upload Files')}
            </Button>
            
            {/* Health Professionals (Pro) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ghost/pricing')}
              className="gap-2 rounded-full border-[#1D4E5F]/30 text-[#1D4E5F] hover:bg-[#1D4E5F]/10 transition-all"
            >
              <Zap className="w-4 h-4" />
              {t('ghost.modules.health.healthProfessionals', 'Health Professionals')}
            </Button>
          </div>

          {/* Human Professional Modal */}
          {showHumanModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowHumanModal(false)}>
              <Suspense fallback={
                <Card className="flex items-center justify-center h-[400px] w-[500px] bg-white">
                  <Loader2 className="w-8 h-8 text-[#2A8C86] animate-spin" />
                </Card>
              }>
                <HumanProfessionalModal onClose={() => setShowHumanModal(false)} />
              </Suspense>
            </div>
          )}

          {/* Health Consult Chat - Text-based Anthropic Triage */}
          {showConsult && (
            <Suspense fallback={
              <Card className="flex items-center justify-center h-[600px] bg-white">
                <Loader2 className="w-10 h-10 text-[#2A8C86] animate-spin" />
              </Card>
            }>
              <HealthConsultChat onClose={() => setShowConsult(false)} />
            </Suspense>
          )}

          {/* Voice Avatar Section */}
          {showAvatar && (
            <Suspense fallback={
              <Card className="flex items-center justify-center h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700">
                <Loader2 className="w-10 h-10 text-[#2A8C86] animate-spin" />
              </Card>
            }>
              <HealthVoiceChat onClose={() => setShowAvatar(false)} />
            </Suspense>
          )}

          {/* Sessions Panel */}
          {showSessions && (
            <Suspense fallback={<Card className="h-[200px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></Card>}>
              <HealthSessionPanel
                conversations={conversations}
                onDeleteSession={async (id) => await deleteConversation(id)}
                onSelectSession={(id) => console.log('Selected session:', id)}
              />
            </Suspense>
          )}

          {/* Image Upload Panel */}
          {showUpload && (
            <Suspense fallback={<Card className="h-[200px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></Card>}>
              <Card className="p-4">
                <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#2A8C86]" />
                  {t('ghost.health.upload.title', 'Upload Health Files for AI Analysis')}
                </h3>
                <HealthImageUpload
                  onFileAnalyzed={(file) => console.log('File analyzed:', file.filename)}
                  maxFiles={5}
                />
              </Card>
            </Suspense>
          )}

          {/* Search Result */}
          {result && (
            <Card className="p-6 bg-white shadow-sm border-slate-200/60">
              <div className="prose prose-slate max-w-none">
                {result.content.split('\n').map((paragraph, i) => (
                  paragraph.trim() && (
                    <p key={i} className="text-slate-700 leading-relaxed">{paragraph}</p>
                  )
                ))}
              </div>
              
              {result.citations?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {result.citations.map((citation) => (
                      <a
                        key={citation.index}
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-full text-xs text-slate-600"
                      >
                        [{citation.index}]
                        {citation.domain}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical Disclaimer */}
              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-800">
                  {t('ghost.modules.health.disclaimer', 'This information is for educational purposes only. Always consult with qualified healthcare professionals for medical advice.')}
                </p>
              </div>
            </Card>
          )}

          {/* Categories */}
          {!result && !showAvatar && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-500 text-center">{t('ghost.modules.health.exploreByCategory')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {HEALTH_CATEGORIES.map((category) => (
                  <button
                    key={category.nameKey}
                    onClick={() => setQuery(t('ghost.modules.health.researchIn', { category: t(category.nameKey) }))}
                    className="relative h-32 rounded-xl overflow-hidden group"
                  >
                    <img src={category.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <span className="absolute bottom-3 left-3 right-3 text-white text-sm font-medium text-left">
                      {t(category.nameKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DiscoverLayout>
  );
}
