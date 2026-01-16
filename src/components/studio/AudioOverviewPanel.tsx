import React, { useState, useCallback } from 'react';
import { Mic, Settings, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotebookLM } from '@/hooks/useNotebookLM';
import { AudioWaveformPlayer } from './AudioWaveformPlayer';

interface AudioOverviewPanelProps {
  notebookId: string;
  sourcesCount: number;
  className?: string;
}

type AudioStyle = 'DEEP_DIVE' | 'SUMMARY' | 'BRIEF' | 'DEBATE';

const STYLE_OPTIONS: { value: AudioStyle; label: string; description: string }[] = [
  { value: 'DEEP_DIVE', label: 'Deep Dive', description: 'Comprehensive 15-20 min discussion' },
  { value: 'SUMMARY', label: 'Summary', description: 'Quick 5-7 min overview' },
  { value: 'BRIEF', label: 'Brief', description: '2-3 min highlights' },
  { value: 'DEBATE', label: 'Debate', description: 'Two hosts with opposing views' },
];

interface AudioProgress {
  status: 'idle' | 'generating' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  audioUrl?: string;
}

export function AudioOverviewPanel({ notebookId, sourcesCount, className }: AudioOverviewPanelProps) {
  const { generateAudioOverview } = useNotebookLM();
  const [audioProgress, setAudioProgress] = useState<AudioProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [selectedStyle, setSelectedStyle] = useState<AudioStyle>('DEEP_DIVE');
  const [focusTopic, setFocusTopic] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const handleGenerate = useCallback(async () => {
    if (sourcesCount === 0) return;
    
    setAudioProgress({ status: 'generating', progress: 5, message: 'Starting audio generation...' });
    
    try {
      const result = await generateAudioOverview(notebookId, {
        style: selectedStyle,
        focus: focusTopic || undefined,
        onProgress: (progress: number, stage: string) => {
          setAudioProgress(prev => ({
            ...prev,
            progress,
            message: stage,
            status: 'processing'
          }));
        }
      });
      
      if (result?.audioUrl) {
        setAudioProgress({
          status: 'complete',
          progress: 100,
          message: 'Audio ready!',
          audioUrl: result.audioUrl
        });
      } else {
        // Fallback if no audio URL but we got segments
        setAudioProgress({
          status: 'complete',
          progress: 100,
          message: 'Transcript ready!',
        });
      }
    } catch (err: any) {
      setAudioProgress({
        status: 'error',
        progress: 0,
        message: err.message || 'Failed to generate audio'
      });
    }
  }, [notebookId, sourcesCount, selectedStyle, focusTopic, generateAudioOverview]);
  
  const isGenerating = audioProgress.status === 'generating' || audioProgress.status === 'processing';
  
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Audio Overview</h3>
              <p className="text-xs text-muted-foreground">AI-generated podcast from your sources</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showSettings ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-4 border-b border-border bg-muted/10 space-y-4">
          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Style</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedStyle(option.value)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    selectedStyle === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground block">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Focus Topic */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Focus Topic <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="e.g., Focus on the methodology section"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      )}
      
      {/* Progress / Player Area */}
      <div className="p-4">
        {audioProgress.status === 'idle' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Generate a podcast-style discussion<br />about your {sourcesCount} source{sourcesCount !== 1 ? 's' : ''}
            </p>
            <button
              onClick={handleGenerate}
              disabled={sourcesCount === 0}
              className={cn(
                "px-6 py-3 rounded-xl font-medium transition-all",
                sourcesCount > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Generate Audio Overview
            </button>
          </div>
        )}
        
        {isGenerating && (
          <div className="py-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-foreground">{audioProgress.message}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                  style={{ width: `${audioProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(audioProgress.progress)}% complete • This may take a few minutes
              </p>
            </div>
          </div>
        )}
        
        {audioProgress.status === 'complete' && audioProgress.audioUrl && (
          <AudioWaveformPlayer 
            audioUrl={audioProgress.audioUrl}
            title="Audio Overview"
            subtitle={`${selectedStyle.toLowerCase().replace('_', ' ')} style`}
          />
        )}
        
        {audioProgress.status === 'complete' && !audioProgress.audioUrl && (
          <div className="text-center py-6">
            <p className="text-sm text-foreground mb-2">Transcript generated successfully!</p>
            <p className="text-xs text-muted-foreground">Audio synthesis is processing in the background.</p>
          </div>
        )}
        
        {audioProgress.status === 'error' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-destructive mb-4">{audioProgress.message}</p>
            <button
              onClick={() => setAudioProgress({ status: 'idle', progress: 0, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
