import { useState } from 'react';
import { Mic, Loader2, Radio, Clock, Sparkles, Globe, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { saveAudioBriefing } from '@/lib/memory/memory-store';
import type { AudioBriefing, BriefingFormat, BriefingDuration } from '@/types/audio-briefing';

interface AudioBriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Array<{ id: string; title: string; content: string }>;
  projectId?: string;
  onComplete?: (briefing: AudioBriefing) => void;
}

const FORMAT_OPTIONS: Array<{ value: BriefingFormat; label: string; description: string }> = [
  { value: 'deep_dive', label: 'Deep Dive', description: 'Comprehensive analysis' },
  { value: 'quick_brief', label: 'Quick Brief', description: 'Executive summary' },
  { value: 'debate', label: 'Debate', description: 'Two perspectives' },
  { value: 'critique', label: 'Critique', description: 'Critical analysis' },
  { value: 'tutorial', label: 'Tutorial', description: 'Step-by-step' },
];

const DURATION_OPTIONS: Array<{ value: BriefingDuration; label: string; time: string }> = [
  { value: 'short', label: 'Short', time: '3-5 min' },
  { value: 'medium', label: 'Medium', time: '7-10 min' },
  { value: 'long', label: 'Long', time: '15-20 min' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export function AudioBriefingDialog({
  open,
  onOpenChange,
  documents,
  projectId,
  onComplete,
}: AudioBriefingDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [format, setFormat] = useState<BriefingFormat>('deep_dive');
  const [duration, setDuration] = useState<BriefingDuration>('medium');
  const [language, setLanguage] = useState<string>(i18n.language?.substring(0, 2) || 'en');
  const [customContext, setCustomContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({ title: 'No documents', description: 'Add documents to generate a briefing', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStage(t('briefings.stages.analyzing', 'Analyzing documents...'));

    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          const stages = [
            t('briefings.stages.analyzing', 'Analyzing documents...'),
            t('briefings.stages.outline', 'Creating outline...'),
            t('briefings.stages.script', 'Writing script...'),
            t('briefings.stages.audio', 'Generating audio...'),
            t('briefings.stages.uploading', 'Uploading audio...'),
          ];
          const stageIndex = Math.floor(p / 20);
          setStage(stages[Math.min(stageIndex, stages.length - 1)]);
          return p + 2;
        });
      }, 1000);

      const { data, error } = await supabase.functions.invoke('audio-briefing', {
        body: {
          documents: documents.map(d => ({ title: d.title, content: d.content })),
          format,
          duration,
          language,
          customContext: customContext.trim() || undefined,
          title: `Briefing: ${documents[0]?.title || 'Documents'}`,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      setStage(t('briefings.stages.complete', 'Complete!'));

      const briefing: AudioBriefing = {
        id: data.id || crypto.randomUUID(),
        projectId,
        title: data.title,
        format: data.format,
        duration: data.duration,
        // URL-based audio (from Supabase Storage)
        audioUrl: data.audioUrl,
        audioSize: data.audioSize,
        storagePath: data.storagePath,
        expiresAt: data.expiresAt,
        // Legacy support
        audioDataUrl: data.audioDataUrl,
        transcript: data.transcript || [],
        outline: data.outline || { title: data.title, keyThemes: [], keyFacts: [], questions: [] },
        sourceDocuments: documents.map(d => d.id),
        createdAt: data.createdAt || new Date().toISOString(),
        status: 'ready',
      };

      // Save to IndexedDB
      await saveAudioBriefing(briefing);

      toast({ 
        title: t('briefings.success.title', 'Audio briefing ready!'), 
        description: t('briefings.success.description', 'Your briefing has been generated and saved.'),
      });
      
      onComplete?.(briefing);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[AudioBriefingDialog] Error:', error);
      toast({
        title: t('briefings.error.title', 'Generation failed'),
        description: error.message || t('briefings.error.description', 'Could not generate briefing'),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setStage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            {t('briefings.dialog.title', 'Generate Audio Briefing')}
          </DialogTitle>
          <DialogDescription>
            {t('briefings.dialog.description', 'Create a podcast-style briefing from {{count}} document', { count: documents.length })}{documents.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative">
                <Radio className="h-12 w-12 text-primary animate-pulse" />
                <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-bounce" />
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{stage}</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Language Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                {t('briefings.language.label', 'Language')}
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('briefings.format.label', 'Format')}</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as BriefingFormat)} className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={opt.value}
                    className={`flex flex-col items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                      format === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Duration Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                {t('briefings.duration.label', 'Duration')}
              </Label>
              <RadioGroup value={duration} onValueChange={(v) => setDuration(v as BriefingDuration)} className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`dur-${opt.value}`}
                    className={`flex-1 flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      duration === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} id={`dur-${opt.value}`} className="sr-only" />
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.time}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Custom Context / Perspectives */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                {t('briefings.context.label', 'Custom Perspectives (Optional)')}
              </Label>
              <Textarea
                placeholder={t('briefings.context.placeholder', 'Add specific perspectives, questions, or key information you want the briefing to focus on...')}
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t('briefings.context.hint', 'e.g., "Focus on financial implications", "Consider sustainability aspects", "Compare with industry standards"')}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || documents.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('briefings.generating', 'Generating...')}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                {t('briefings.generate', 'Generate')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
