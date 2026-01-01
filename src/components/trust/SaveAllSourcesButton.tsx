import { useState } from 'react';
import { 
  BookmarkPlus, 
  Loader2, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { getMasterKey } from '@/lib/crypto/key-vault';
import { 
  saveMultipleSourcesToMemory, 
  saveResearchSession 
} from '@/lib/memory/source-to-memory';
import type { WebSource } from '@/lib/trust/verified-search';

interface SaveAllSourcesButtonProps {
  sources: WebSource[];
  query: string;
  folders?: Array<{ id: string; name: string }>;
  onComplete?: () => void;
}

export function SaveAllSourcesButton({
  sources,
  query,
  folders = [],
  onComplete
}: SaveAllSourcesButtonProps) {
  const { toast } = useToast();
  const { isUnlocked } = useEncryptionContext();
  
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, source: '' });
  const [results, setResults] = useState<{ successful: number; failed: number } | null>(null);
  
  const authoritativeUrls = new Set(
    sources.filter(s => s.trustLevel === 'authoritative' || s.trustLevel === 'reliable').map(s => s.url)
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(authoritativeUrls);
  const [selectedFolder, setSelectedFolder] = useState('none');
  const [createSession, setCreateSession] = useState(true);
  const [sessionName, setSessionName] = useState(`Research: ${query.slice(0, 50)}`);
  
  const toggleSource = (url: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedSources(newSelected);
  };
  
  const selectAll = () => setSelectedSources(new Set(sources.map(s => s.url)));
  const selectNone = () => setSelectedSources(new Set());
  const selectAuthoritative = () => setSelectedSources(authoritativeUrls);
  
  const handleSave = async () => {
    if (!isUnlocked) {
      toast({
        title: 'Vault locked',
        description: 'Unlock your vault to save sources',
        variant: 'destructive'
      });
      return;
    }
    
    if (selectedSources.size === 0) {
      toast({
        title: 'No sources selected',
        description: 'Select at least one source to save',
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    setProgress({ current: 0, total: selectedSources.size, source: '' });
    
    try {
      const key = getMasterKey();
      if (!key) throw new Error('No encryption key');
      
      const sourcesToSave = sources.filter(s => selectedSources.has(s.url));
      
      const result = await saveMultipleSourcesToMemory(
        sourcesToSave,
        key,
        {
          fetchFullContent: true,
          folderId: selectedFolder !== 'none' ? selectedFolder : undefined
        },
        (current, total, source) => {
          setProgress({ current, total, source });
        }
      );
      
      if (createSession && result.successful > 0) {
        saveResearchSession({
          name: sessionName,
          query,
          sources: result.results
            .filter(r => r.success)
            .map(r => r.sourceId),
          tags: []
        });
      }
      
      setResults(result);
      
      toast({
        title: 'Sources saved',
        description: `${result.successful} sources added to memory`
      });
      
      if (result.successful > 0) {
        onComplete?.();
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleClose = () => {
    setOpen(false);
    setResults(null);
    setProgress({ current: 0, total: 0, source: '' });
  };

  const authoritativeCount = sources.filter(s => 
    s.trustLevel === 'authoritative' || s.trustLevel === 'reliable'
  ).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus className="h-4 w-4 mr-2" />
          Save All Sources
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5" />
            Save Sources to Memory
          </DialogTitle>
          <DialogDescription>
            Add these verified sources to your personal knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        {!results ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  All ({sources.length})
                </Button>
                <Button variant="outline" size="sm" onClick={selectAuthoritative}>
                  Authoritative ({authoritativeCount})
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  None
                </Button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sources.map((source) => (
                  <div
                    key={source.url}
                    className="flex items-start gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleSource(source.url)}
                  >
                    <Checkbox
                      checked={selectedSources.has(source.url)}
                      onCheckedChange={() => toggleSource(source.url)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {source.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {source.domain}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {source.trustLevel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {(source.trustScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <Label>Save to folder</Label>
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder (root)</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createSession"
                    checked={createSession}
                    onCheckedChange={(checked) => setCreateSession(checked as boolean)}
                  />
                  <Label htmlFor="createSession" className="text-sm">
                    Create research session (groups these sources)
                  </Label>
                </div>
                {createSession && (
                  <Input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full"
                    placeholder="Session name"
                  />
                )}
              </div>
              
              {saving && (
                <div className="space-y-2">
                  <Progress value={(progress.current / progress.total) * 100} />
                  <p className="text-xs text-muted-foreground text-center">
                    Saving {progress.current} of {progress.total}: {progress.source}
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || selectedSources.size === 0}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Save {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            {results.successful > 0 ? (
              <>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-lg font-medium">Sources Saved!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.successful} source{results.successful !== 1 ? 's' : ''} added to your memory
                </p>
                {results.failed > 0 && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {results.failed} source{results.failed !== 1 ? 's' : ''} failed to save
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-lg font-medium">Save Failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Could not save sources to memory
                </p>
              </>
            )}
            
            <Button onClick={handleClose} className="mt-4">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
