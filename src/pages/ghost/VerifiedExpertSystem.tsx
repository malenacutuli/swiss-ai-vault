/**
 * Verified Expert System - Comprehensive Healthcare Consultation Platform
 * 
 * Unified interface for:
 * - Health Consult (Text-based AI triage with Anthropic)
 * - Talk to Healthcare Agent (Voice-based with Hume)
 * - Request Human Professional (Emergency & scheduling)
 * - My Sessions (Session history management)
 * - Upload Files (Document analysis within chat)
 * - Medical History Report Generation
 */

import { useState, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHealthStorage, ConversationSummary } from '@/hooks/useHealthStorage';
import { cn } from '@/lib/utils';
import {
  Shield,
  Stethoscope,
  Mic,
  UserRound,
  FolderOpen,
  FileText,
  BadgeCheck,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Heart,
} from 'lucide-react';

// Lazy load heavy components
const HealthConsultChat = lazy(() => 
  import('@/components/ghost/health/HealthConsultChat').then(m => ({ default: m.HealthConsultChat }))
);
const HealthVoiceChat = lazy(() => 
  import('@/components/ghost/health/HealthVoiceChat').then(m => ({ default: m.HealthVoiceChat }))
);
const HumanProfessionalModal = lazy(() => 
  import('@/components/ghost/health/HumanProfessionalModal').then(m => ({ default: m.HumanProfessionalModal }))
);
const HealthSessionPanel = lazy(() => 
  import('@/components/ghost/health/HealthSessionPanel').then(m => ({ default: m.HealthSessionPanel }))
);
const VerifiedExpertConsult = lazy(() => 
  import('@/components/ghost/health/VerifiedExpertConsult').then(m => ({ default: m.VerifiedExpertConsult }))
);
const MedicalHistoryReport = lazy(() => 
  import('@/components/ghost/health/MedicalHistoryReport').then(m => ({ default: m.MedicalHistoryReport }))
);

type ActiveView = 'overview' | 'consult' | 'voice' | 'human' | 'sessions' | 'report';

const EXPERT_FEATURES = [
  {
    id: 'consult',
    icon: Stethoscope,
    title: 'Health Consult',
    description: 'AI-powered triage with document upload & follow-up questions',
    color: 'emerald',
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Talk to Healthcare Agent',
    description: 'Voice-based consultation with 3D AI avatar',
    color: 'teal',
  },
  {
    id: 'human',
    icon: UserRound,
    title: 'Request Human Professional',
    description: 'Connect with healthcare professionals & emergency services',
    color: 'blue',
  },
  {
    id: 'sessions',
    icon: FolderOpen,
    title: 'My Sessions',
    description: 'View, download and manage your consultation history',
    color: 'slate',
  },
  {
    id: 'report',
    icon: ClipboardList,
    title: 'Medical History Report',
    description: 'Generate comprehensive medical history from your sessions',
    color: 'purple',
  },
] as const;

export default function VerifiedExpertSystem() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  
  const { 
    conversations, 
    deleteConversation, 
    isLoading: healthStorageLoading 
  } = useHealthStorage();

  const handleBack = useCallback(() => {
    setActiveView('overview');
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'consult':
        return (
          <Suspense fallback={<LoadingCard />}>
            <VerifiedExpertConsult onClose={handleBack} />
          </Suspense>
        );
      
      case 'voice':
        return (
          <Suspense fallback={<LoadingCard />}>
            <HealthVoiceChat onClose={handleBack} />
          </Suspense>
        );
      
      case 'human':
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && handleBack()}>
            <Suspense fallback={<LoadingCard />}>
              <HumanProfessionalModal onClose={handleBack} />
            </Suspense>
          </div>
        );
      
      case 'sessions':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('common.back', 'Back')}
              </Button>
              <h2 className="text-lg font-semibold text-slate-800">
                {t('ghost.health.sessions.title', 'My Health Sessions')}
              </h2>
            </div>
            <Suspense fallback={<LoadingCard />}>
              <HealthSessionPanel
                conversations={conversations}
                onDeleteSession={async (id) => await deleteConversation(id)}
                onSelectSession={(id) => console.log('Selected session:', id)}
              />
            </Suspense>
          </div>
        );
      
      case 'report':
        return (
          <Suspense fallback={<LoadingCard />}>
            <MedicalHistoryReport onClose={handleBack} conversations={conversations} />
          </Suspense>
        );
      
      default:
        return <OverviewPanel onNavigate={setActiveView} sessionCount={conversations.length} />;
    }
  };

  return (
    <DiscoverLayout activeModule="health">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          
          {/* Header */}
          {activeView === 'overview' && (
            <>
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-200">
                  <BadgeCheck className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    {t('ghost.health.verified.badge', 'Verified Expert System')}
                  </span>
                </div>
                <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {t('ghost.health.verified.title', 'Healthcare Consultation Platform')}
                </h1>
                <p className="text-slate-500 max-w-2xl mx-auto">
                  {t('ghost.health.verified.subtitle', 'AI-powered triage, voice consultations, document analysis, and medical history report generation — all in one secure platform.')}
                </p>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap justify-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  {t('ghost.health.verified.localStorage', 'Local-first encrypted storage')}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600">
                  <Heart className="w-3.5 h-3.5 text-red-400" />
                  {t('ghost.health.verified.hipaaNote', 'HIPAA-conscious design')}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full text-xs text-slate-600">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  {t('ghost.health.verified.exportable', 'Exportable transcripts & reports')}
                </div>
              </div>
            </>
          )}

          {/* Main Content */}
          {renderContent()}

        </div>
      </div>
    </DiscoverLayout>
  );
}

// Overview Panel with feature cards
function OverviewPanel({ 
  onNavigate, 
  sessionCount 
}: { 
  onNavigate: (view: ActiveView) => void;
  sessionCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {EXPERT_FEATURES.map((feature) => (
        <Card
          key={feature.id}
          className={cn(
            "p-5 cursor-pointer transition-all hover:shadow-md hover:border-[#1D4E5F]/30 group",
            "border-slate-200"
          )}
          onClick={() => onNavigate(feature.id as ActiveView)}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
              feature.color === 'emerald' && "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200",
              feature.color === 'teal' && "bg-teal-100 text-teal-600 group-hover:bg-teal-200",
              feature.color === 'blue' && "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
              feature.color === 'slate' && "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
              feature.color === 'purple' && "bg-purple-100 text-purple-600 group-hover:bg-purple-200"
            )}>
              <feature.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800 group-hover:text-[#1D4E5F]">
                  {t(`ghost.health.verified.features.${feature.id}.title`, feature.title)}
                </h3>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1D4E5F] transition-colors" />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {t(`ghost.health.verified.features.${feature.id}.description`, feature.description)}
              </p>
              {feature.id === 'sessions' && sessionCount > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  {sessionCount} {t('ghost.health.verified.sessionsCount', 'sessions saved')}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Quick Tips Card */}
      <Card className="p-5 bg-gradient-to-br from-[#1D4E5F]/5 to-[#2A8C86]/5 border-[#1D4E5F]/20 col-span-full">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1D4E5F]/10 flex items-center justify-center">
            <BadgeCheck className="w-5 h-5 text-[#1D4E5F]" />
          </div>
          <div>
            <h4 className="font-medium text-slate-800 mb-1">
              {t('ghost.health.verified.tips.title', 'How to Use the Expert System')}
            </h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2A8C86]" />
                {t('ghost.health.verified.tips.1', 'Upload medical documents during chat for contextual analysis')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2A8C86]" />
                {t('ghost.health.verified.tips.2', 'Voice consultations are transcribed and saved automatically')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2A8C86]" />
                {t('ghost.health.verified.tips.3', 'Generate medical history reports to share with your doctor')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2A8C86]" />
                {t('ghost.health.verified.tips.4', 'All data is stored locally and encrypted on your device')}
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Loading placeholder
function LoadingCard() {
  return (
    <Card className="h-[500px] flex items-center justify-center bg-white">
      <Loader2 className="w-10 h-10 text-[#2A8C86] animate-spin" />
    </Card>
  );
}
