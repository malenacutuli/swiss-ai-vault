/**
 * HELIOS Assessment Results Panel
 * Displays comprehensive AI assessment results in expandable sections
 * Matches Doctronic's polished output format
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Stethoscope, 
  ChevronDown,
  ChevronUp,
  Download, 
  Share2, 
  Video,
  FileText,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupportedLanguage } from '@/lib/helios/types';
import { getAssessmentTranslation, type AssessmentTranslationKey } from './assessmentTranslations';

interface DiagnosisItem {
  rank: number;
  diagnosis: string;
  confidence?: number;
  description?: string;
  icdCode?: string;
}

interface PlanCategory {
  title: string;
  items: string[];
}

interface SOAPNote {
  subjective: string[];
  objective: string[];
  assessment: string[];
  plan: string[];
}

interface AssessmentData {
  sessionId: string;
  timestamp: Date;
  summary: string;
  urgencyLevel: 'emergency' | 'urgent' | 'soon' | 'routine';
  recommendDoctor: boolean;
  differential: DiagnosisItem[];
  planOfAction: PlanCategory[];
  soapNote: SOAPNote;
  healthRecordNote?: string;
  warningSignsToWatch?: string[];
}

interface AssessmentResultsPanelProps {
  data: AssessmentData;
  language?: SupportedLanguage;
  onBookDoctor?: () => void;
  onDownloadPDF?: () => void;
  onShareSummary?: () => void;
  onFeedback?: (rating: 'not-helpful' | 'so-so' | 'helpful') => void;
  onContinueConsult?: () => void;
  onUpdateHealthRecord?: () => void;
  className?: string;
}

type FeedbackRating = 'not-helpful' | 'so-so' | 'helpful' | null;

export function AssessmentResultsPanel({
  data,
  language = 'en',
  onBookDoctor,
  onDownloadPDF,
  onShareSummary,
  onFeedback,
  onContinueConsult,
  onUpdateHealthRecord,
  className,
}: AssessmentResultsPanelProps) {
  const { t, i18n } = useTranslation();
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [soapOpen, setSoapOpen] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackRating>(null);

  // Helper to get translation with fallback to inline translations
  const getText = (i18nKey: string, fallbackKey: AssessmentTranslationKey, defaultValue?: string): string => {
    const translated = t(i18nKey, { defaultValue: '' });
    if (translated && translated !== i18nKey) return translated;
    return getAssessmentTranslation(language || i18n.language, fallbackKey) || defaultValue || '';
  };

  const formatDate = (date: Date) => {
    const localeMap: Record<SupportedLanguage, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      pt: 'pt-PT',
      it: 'it-IT',
      ca: 'ca-ES',
    };
    
    return new Intl.DateTimeFormat(localeMap[language] || 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language === 'en',
    }).format(date);
  };

  const handleFeedback = (rating: 'not-helpful' | 'so-so' | 'helpful') => {
    setFeedbackGiven(rating);
    onFeedback?.(rating);
  };

  const getUrgencyStyles = (level: AssessmentData['urgencyLevel']) => {
    switch (level) {
      case 'emergency':
        return 'bg-destructive/10 border-destructive text-destructive';
      case 'urgent':
        return 'bg-orange-500/10 border-orange-500 text-orange-600';
      case 'soon':
        return 'bg-yellow-500/10 border-yellow-500 text-yellow-600';
      default:
        return 'bg-emerald-500/10 border-emerald-500 text-emerald-600';
    }
  };

  const getUrgencyLabel = (level: AssessmentData['urgencyLevel']) => {
    const labels: Record<AssessmentData['urgencyLevel'], string> = {
      emergency: getText('helios.triage.emergency', 'emergency', 'Emergency'),
      urgent: getText('helios.triage.urgent', 'urgent', 'Urgent'),
      soon: getText('helios.triage.soon', 'soon', 'See Soon'),
      routine: getText('helios.triage.routine', 'routine', 'Routine'),
    };
    return labels[level];
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* ============================================ */}
      {/* AI CONSULT SUMMARY */}
      {/* ============================================ */}
      <Card className="p-6 bg-card border-border">
        {/* Header with icon and urgency badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {getText('helios.assessment.aiConsultSummary', 'aiConsultSummary', 'AI Consult Summary')}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(data.timestamp)}
              </p>
            </div>
          </div>
          
          <span className={cn(
            'px-3 py-1 text-xs font-medium rounded-full border',
            getUrgencyStyles(data.urgencyLevel)
          )}>
            {getUrgencyLabel(data.urgencyLevel)}
          </span>
        </div>

        {/* Summary narrative */}
        <div className="bg-muted/30 rounded-lg p-4 mb-4">
          <p className="text-foreground leading-relaxed">
            {data.summary}
          </p>
        </div>

        {/* Video consultation available indicator */}
        {data.recommendDoctor && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Video className="w-4 h-4" />
            <span>{getText('helios.assessment.videoAvailable', 'videoAvailable', 'Video consultation available')}</span>
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* WARNING SIGNS TO WATCH */}
      {/* ============================================ */}
      {data.warningSignsToWatch && data.warningSignsToWatch.length > 0 && (
        <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-orange-500/5 transition-colors rounded-t-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">
                    {getText('helios.assessment.warningSignsTitle', 'warningSignsTitle', 'Warning Signs to Watch')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getText('helios.assessment.warningSignsDesc', 'warningSignsDesc', 'Seek immediate care if these occur')}
                  </p>
                </div>
              </div>
              {warningsOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <ul className="space-y-2">
                  {data.warningSignsToWatch.map((sign, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-orange-500 mt-0.5">⚠</span>
                      <span>{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ============================================ */}
      {/* DOCTOR RECOMMENDATION BANNER */}
      {/* ============================================ */}
      {data.recommendDoctor && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {getText('helios.assessment.recommendDoctor', 'recommendDoctor', 'We Recommend You See a Doctor')}
            </h3>
          </div>

          <ul className="space-y-2 mb-5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span>
              {getText('helios.assessment.videoCost', 'videoCost', 'Video visits with our licensed doctors cost $39.')}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span>
              {getText('helios.assessment.insurance', 'insurance', 'We also accept all major insurance.')}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span>
              {getText('helios.assessment.prescriptions', 'prescriptions', 'Get your prescriptions and more in as little as 30 minutes.')}
            </li>
          </ul>

          <Button 
            onClick={onBookDoctor} 
            className="w-full mb-3"
            size="lg"
          >
            <Video className="w-4 h-4 mr-2" />
            {getText('helios.assessment.seeDoctor', 'seeDoctor', 'See a Doctor')}
          </Button>

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" />
            {getText('helios.assessment.immediatelyAvailable', 'immediatelyAvailable', 'Video appointments available immediately.')}
          </p>
        </Card>
      )}

      {/* ============================================ */}
      {/* FEEDBACK SECTION */}
      {/* ============================================ */}
      <Card className="p-6 text-center bg-card border-border">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {getText('helios.assessment.feedbackQuestion', 'feedbackQuestion', 'How helpful was HELIOS for you today?')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {getText('helios.assessment.feedbackHelps', 'feedbackHelps', 'Your feedback helps make us better.')}
        </p>

        <div className="flex justify-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleFeedback('not-helpful')}
            disabled={feedbackGiven !== null}
            className={cn(
              'px-5 py-2.5 rounded-full transition-all',
              feedbackGiven === 'not-helpful' && 'bg-muted border-primary ring-2 ring-primary/20'
            )}
          >
            😕 {getText('helios.assessment.notHelpful', 'notHelpful', 'Not Helpful')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleFeedback('so-so')}
            disabled={feedbackGiven !== null}
            className={cn(
              'px-5 py-2.5 rounded-full transition-all',
              feedbackGiven === 'so-so' && 'bg-muted border-primary ring-2 ring-primary/20'
            )}
          >
            😐 {getText('helios.assessment.soSo', 'soSo', 'So-So')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleFeedback('helpful')}
            disabled={feedbackGiven !== null}
            className={cn(
              'px-5 py-2.5 rounded-full transition-all',
              feedbackGiven === 'helpful' && 'bg-muted border-primary ring-2 ring-primary/20'
            )}
          >
            🙂 {getText('helios.assessment.helpful', 'helpful', 'Helpful')}
          </Button>
        </div>

        {feedbackGiven && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
            <CheckCircle className="w-4 h-4" />
            {getText('helios.assessment.thankYouFeedback', 'thankYouFeedback', 'Thank you for your feedback!')}
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* ASSESSMENT & PLAN (Expandable) */}
      {/* ============================================ */}
      <Collapsible open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <Card className="overflow-hidden bg-card border-border">
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">
                  {getText('helios.assessment.assessmentPlan', 'assessmentPlan', 'Assessment & Plan')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {getText('helios.assessment.clinicalOverview', 'clinicalOverview', 'A clinical overview of possible causes considered')}
                </p>
              </div>
            </div>
            {assessmentOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-6">
              {/* Introduction */}
              <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                {getText('helios.assessment.differentialIntro', 'differentialIntro', 'Below is a differential diagnosis and a plan of action based on your symptoms, background, and the details you have provided.')}
              </p>

              {/* Differential Diagnosis */}
              <div>
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {getText('helios.assessment.differentialTitle', 'differentialTitle', 'Differential Diagnosis (ranked from most to least likely):')}
                </h4>
                <div className="space-y-2">
                  {data.differential.map((dx) => (
                    <div 
                      key={dx.rank} 
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                        {dx.rank}
                      </span>
                      <div className="flex-1">
                        <span className="font-medium text-foreground">{dx.diagnosis}</span>
                        {dx.confidence && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({Math.round(dx.confidence * 100)}% {getText('helios.assessment.confidence', 'confidence', 'confidence')})
                          </span>
                        )}
                        {dx.description && (
                          <p className="text-sm text-muted-foreground mt-1">{dx.description}</p>
                        )}
                        {dx.icdCode && (
                          <span className="text-xs text-muted-foreground font-mono">ICD-10: {dx.icdCode}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan of Action */}
              <div>
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {getText('helios.assessment.planTitle', 'planTitle', 'Plan of Action for Confirming Diagnosis')}
                </h4>
                <div className="space-y-4">
                  {data.planOfAction.map((category, idx) => (
                    <div key={idx} className="pl-3">
                      <h5 className="text-sm font-medium text-foreground mb-2">
                        • {category.title}
                      </h5>
                      <ul className="space-y-1 pl-4">
                        {category.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-muted-foreground/50">–</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ============================================ */}
      {/* SOAP NOTE (Expandable) */}
      {/* ============================================ */}
      <Collapsible open={soapOpen} onOpenChange={setSoapOpen}>
        <Card className="overflow-hidden bg-card border-border">
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">
                  {t('helios.soap.title', 'SOAP Note')} <span className="text-muted-foreground font-normal">({getText('helios.soap.forPhysicians', 'forPhysicians', 'for Physicians')})</span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {getText('helios.soap.description', 'soapDescription', 'A clinical summary to share with your doctor')}
                </p>
              </div>
            </div>
            {soapOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-5">
              {/* Subjective */}
              <div>
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {t('helios.soap.subjective', 'Subjective')}
                </h4>
                <ul className="space-y-1.5 pl-4">
                  {data.soapNote.subjective.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Objective */}
              <div>
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t('helios.soap.objective', 'Objective')}
                </h4>
                <ul className="space-y-1.5 pl-4">
                  {data.soapNote.objective.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Assessment */}
              <div>
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  {t('helios.soap.assessment', 'Assessment')}
                </h4>
                <ul className="space-y-1.5 pl-4">
                  {data.soapNote.assessment.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan */}
              <div>
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  {t('helios.soap.plan', 'Plan')}
                </h4>
                <ul className="space-y-1.5 pl-4">
                  {data.soapNote.plan.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ============================================ */}
      {/* DOWNLOAD & SHARE BUTTONS */}
      {/* ============================================ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={onDownloadPDF}
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          {getText('helios.assessment.downloadPDF', 'downloadPDF', 'Download SOAP Note (PDF)')}
        </Button>
        <Button
          variant="outline"
          onClick={onShareSummary}
          className="flex-1"
        >
          <Share2 className="w-4 h-4 mr-2" />
          {getText('helios.assessment.shareSummary', 'shareSummary', 'Share Summary')}
        </Button>
      </div>

      {/* ============================================ */}
      {/* HEALTH RECORD NOTE */}
      {/* ============================================ */}
      {data.healthRecordNote && (
        <Card className="p-4 bg-muted/30 border-border">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-foreground mb-2">{data.healthRecordNote}</p>
              <Button
                variant="link"
                onClick={onUpdateHealthRecord}
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                {getText('helios.assessment.updateHealthRecord', 'updateHealthRecord', 'Update Health Record')} →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================ */}
      {/* CONTINUED CONSULT */}
      {/* ============================================ */}
      <Card className="p-5 bg-card border-border">
        <Button
          variant="ghost"
          onClick={onContinueConsult}
          className="w-full justify-start mb-3 text-primary hover:text-primary/80 hover:bg-primary/5"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          {getText('helios.assessment.continuedConsult', 'continuedConsult', 'Continued consult')}
        </Button>

        <p className="text-sm text-muted-foreground mb-3">
          {getText('helios.assessment.questionsHelp', 'questionsHelp', "Have questions about your AI visit summary? I'm here to help. Ask me anything.")}
        </p>

        <p className="text-xs text-muted-foreground">
          {getText('helios.assessment.newSymptomsNote', 'newSymptomsNote', 'If you have new symptoms or concerns, please start a new AI consult. You can also speak with a doctor anytime by scrolling up and booking a video visit.')}
        </p>
      </Card>

      {/* ============================================ */}
      {/* MEDICAL DISCLAIMER */}
      {/* ============================================ */}
      <div className="text-center text-xs text-muted-foreground px-4">
        <p>{getText('helios.disclaimer.aiNotDoctor', 'aiNotDoctor', 'This AI assessment is for informational purposes only and does not constitute medical advice, diagnosis, or treatment.')}</p>
      </div>
    </div>
  );
}

export type { AssessmentData, DiagnosisItem, PlanCategory, SOAPNote, AssessmentResultsPanelProps };
