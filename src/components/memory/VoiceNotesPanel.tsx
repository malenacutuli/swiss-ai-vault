// src/components/memory/VoiceNotesPanel.tsx
// Panel for recording and managing voice notes in Personal AI Memory

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Play, Pause, Trash2, Loader2, Clock, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
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
import type { VoiceNoteItem } from '@/lib/memory/memory-store';

interface VoiceNotesPanelProps {
  onNoteAdded?: () => void;
}

export function VoiceNotesPanel({ onNoteAdded }: VoiceNotesPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Load voice notes
  const loadVoiceNotes = useCallback(async () => {
    const key = getMasterKey();
    if (!key) return;
    
    setIsLoading(true);
    try {
      const { getVoiceNotes } = await import('@/lib/memory/memory-store');
      const notes = await getVoiceNotes(key);
      setVoiceNotes(notes);
    } catch (error) {
      console.error('Failed to load voice notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getMasterKey]);
  
  useEffect(() => {
    if (isUnlocked) {
      loadVoiceNotes();
    }
  }, [isUnlocked, loadVoiceNotes]);
  
  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      toast({
        title: t('memory.voiceNotes.microphoneDenied'),
        description: t('memory.voiceNotes.microphoneHint'),
        variant: 'destructive',
      });
    }
  }, [toast, t]);
  
  // Stop recording and save
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    
    const key = getMasterKey();
    if (!key) {
      toast({
        title: t('memory.encryption.vaultLocked'),
        description: t('memory.encryption.unlockVault'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const duration = recordingDuration;
    
    // Stop the media recorder
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
    // Wait for all data
    await new Promise<void>(resolve => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => resolve();
      }
    });
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    if (audioBlob.size < 1000) {
      toast({
        title: t('memory.voiceNotes.recordingTooShort', 'Recording too short'),
        description: t('memory.voiceNotes.recordAtLeast', 'Please record for at least a second'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Transcribe audio
      const { supabase } = await import('@/integrations/supabase/client');
      
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      
      const { data, error } = await supabase.functions.invoke('ghost-voice', {
        body: { action: 'stt', audio: base64Audio, language: 'en' },
      });
      
      if (error) throw error;
      
      const transcript = data?.text || '';
      
      if (!transcript.trim()) {
        toast({
          title: t('memory.voiceNotes.noSpeech', 'No speech detected'),
          description: t('memory.voiceNotes.noSpeechDesc', 'Could not detect any speech in the recording'),
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }
      
      // Generate embedding
      const { embed } = await import('@/lib/memory/embedding-engine');
      const embedding = await embed(transcript);
      
      // Save to memory store
      const { saveVoiceNote } = await import('@/lib/memory/memory-store');
      await saveVoiceNote(audioBlob, transcript, duration, embedding, key, {
        language: 'en',
      });
      
      toast({
        title: t('memory.voiceNotes.saved', 'Voice note saved'),
        description: `${formatDuration(duration)} ${t('memory.voiceNotes.recordedAndTranscribed', 'recorded and transcribed')}`,
      });
      
      await loadVoiceNotes();
      onNoteAdded?.();
      
    } catch (error) {
      console.error('Failed to save voice note:', error);
      toast({
        title: t('memory.voiceNotes.saveFailed', 'Failed to save voice note'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setRecordingDuration(0);
    }
  }, [getMasterKey, recordingDuration, toast, loadVoiceNotes, onNoteAdded]);
  
  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  }, []);
  
  // Play/pause audio
  const togglePlayback = useCallback((note: VoiceNoteItem) => {
    if (playingId === note.id) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
    } else {
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Start new playback
      const audio = new Audio(note.metadata.audioDataUrl);
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.play();
      audioRef.current = audio;
      setPlayingId(note.id);
    }
  }, [playingId]);
  
  // Delete voice note
  const handleDelete = useCallback(async (id: string) => {
    try {
      const { deleteVoiceNote } = await import('@/lib/memory/memory-store');
      await deleteVoiceNote(id);
      
      setVoiceNotes(prev => prev.filter(n => n.id !== id));
      toast({ title: t('memory.voiceNotes.deleted', 'Voice note deleted') });
      
      if (playingId === id) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setPlayingId(null);
      }
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: String(error),
        variant: 'destructive',
      });
    }
    setDeleteConfirmId(null);
  }, [playingId, toast]);
  
  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  if (!isUnlocked) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('memory.encryption.unlockVault')}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Recording Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {t('memory.voiceNotes.record')}
          </CardTitle>
          <CardDescription>
            {t('memory.voiceNotes.recordDesc', 'Record audio notes that are transcribed and searchable in your memory')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            {isRecording ? (
              <>
                <div className="flex items-center gap-2 text-destructive">
                  <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <span className="font-mono text-lg">{formatDuration(recordingDuration)}</span>
                </div>
                <Button variant="outline" onClick={cancelRecording}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={stopRecording}>
                  <MicOff className="h-4 w-4 mr-2" />
                  {t('memory.voiceNotes.stop')}
                </Button>
              </>
            ) : isProcessing ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{t('memory.voiceNotes.transcribing')}</span>
              </div>
            ) : (
              <Button size="lg" onClick={startRecording}>
                <Mic className="h-5 w-5 mr-2" />
                {t('memory.voiceNotes.startRecording', 'Start Recording')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Voice Notes List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('memory.voiceNotes.title')}</CardTitle>
          <CardDescription>
            {voiceNotes.length} {t('memory.voiceNotes.notesRecorded', 'voice notes recorded')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : voiceNotes.length === 0 ? (
            <div className="py-12 text-center">
              <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('memory.voiceNotes.noNotes')}</p>
              <p className="text-sm text-muted-foreground">{t('memory.voiceNotes.recordFirst')}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {voiceNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 mt-1"
                      onClick={() => togglePlayback(note)}
                    >
                      {playingId === note.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">
                          {note.metadata.title}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDuration(note.metadata.duration)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {note.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(note.metadata.createdAt)}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirmId(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('memory.voiceNotes.deleteTitle', 'Delete voice note?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('memory.voiceNotes.deleteDesc', 'This will permanently delete the voice note and its transcript.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
