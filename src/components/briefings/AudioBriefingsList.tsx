import { useState, useEffect } from 'react';
import { Mic, Play, Pause, Trash2, Download, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getAudioBriefings, deleteAudioBriefing } from '@/lib/memory/memory-store';
import type { AudioBriefing } from '@/types/audio-briefing';
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

export function AudioBriefingsList() {
  const { toast } = useToast();
  const [briefings, setBriefings] = useState<AudioBriefing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadBriefings();
  }, []);

  const loadBriefings = async () => {
    try {
      const data = await getAudioBriefings();
      setBriefings(data);
    } catch (error) {
      console.error('Failed to load briefings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = (briefing: AudioBriefing) => {
    if (playingId === briefing.id) {
      audioElement?.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      audioElement?.pause();
      
      if (briefing.audioDataUrl) {
        const audio = new Audio(briefing.audioDataUrl);
        audio.onended = () => {
          setPlayingId(null);
          setAudioElement(null);
        };
        audio.play();
        setPlayingId(briefing.id);
        setAudioElement(audio);
      }
    }
  };

  const handleDownload = (briefing: AudioBriefing) => {
    if (!briefing.audioDataUrl) return;
    
    const link = document.createElement('a');
    link.href = briefing.audioDataUrl;
    link.download = `${briefing.title.replace(/\s+/g, '_')}.mp3`;
    link.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAudioBriefing(id);
      setBriefings(briefings.filter(b => b.id !== id));
      setDeleteId(null);
      toast({ title: 'Briefing deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLabel = (format: string) => {
    return format.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Audio Briefings
        </CardTitle>
        <CardDescription>
          AI-generated podcasts from your documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {briefings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mic className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">No audio briefings yet</p>
            <p className="text-sm text-muted-foreground/70">Generate one from your projects</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {briefings.map((briefing) => (
                <div
                  key={briefing.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium truncate">{briefing.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatLabel(briefing.format)}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {briefing.duration}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(briefing.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => togglePlay(briefing)}
                    >
                      {playingId === briefing.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(briefing)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(briefing.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audio Briefing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this briefing and its audio. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
