import { useState } from 'react';
import { Mic, Loader2, Radio, Clock, Sparkles } from 'lucide-react';
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

export function AudioBriefingDialog({
  open,
  onOpenChange,
  documents,
  projectId,
  onComplete,
}: AudioBriefingDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<BriefingFormat>('deep_dive');
  const [duration, setDuration] = useState<BriefingDuration>('medium');
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
    setStage('Analyzing documents...');

    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          const stages = ['Analyzing documents...', 'Creating outline...', 'Writing script...', 'Generating audio...', 'Uploading audio...'];
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
          title: `Briefing: ${documents[0]?.title || 'Documents'}`,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      setStage('Complete!');

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

      toast({ title: 'Audio briefing ready!', description: 'Your briefing has been generated and saved.' });
      
      onComplete?.(briefing);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[AudioBriefingDialog] Error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Could not generate briefing',
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Generate Audio Briefing
          </DialogTitle>
          <DialogDescription>
            Create a podcast-style briefing from {documents.length} document{documents.length !== 1 ? 's' : ''}
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
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format</Label>
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
                Duration
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
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || documents.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
