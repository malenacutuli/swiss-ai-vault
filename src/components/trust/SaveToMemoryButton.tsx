import { useState } from 'react';
import { 
  BookmarkPlus, 
  Check, 
  Loader2, 
  FolderPlus,
  FileText,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { useEncryption } from '@/hooks/useEncryption';
import { getMasterKey } from '@/lib/crypto/key-vault';
import { saveWebSourceToMemory, type SaveSourceOptions } from '@/lib/memory/source-to-memory';
import type { WebSource } from '@/lib/trust/verified-search';

interface SaveToMemoryButtonProps {
  source: WebSource;
  variant?: 'button' | 'icon' | 'dropdown-item';
  folders?: Array<{ id: string; name: string }>;
  onSaved?: (sourceId: string) => void;
}

export function SaveToMemoryButton({
  source,
  variant = 'button',
  folders = [],
  onSaved
}: SaveToMemoryButtonProps) {
  const { toast } = useToast();
  const { isUnlocked } = useEncryption();
  
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [fetchFullContent, setFetchFullContent] = useState(true);
  const [userNotes, setUserNotes] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };
  
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  const handleSave = async () => {
    if (!isUnlocked) {
      toast({
        title: 'Vault locked',
        description: 'Unlock your vault to save sources to memory',
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const key = getMasterKey();
      if (!key) throw new Error('No encryption key');
      
      const options: SaveSourceOptions = {
        fetchFullContent,
        addUserNotes: userNotes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        folderId: selectedFolder !== 'none' ? selectedFolder : undefined
      };
      
      const result = await saveWebSourceToMemory(source, key, options);
      
      if (result.success) {
        setSaved(true);
        setOpen(false);
        
        toast({
          title: 'Saved to memory',
          description: `${result.chunksCreated} chunks added from "${source.title}"`
        });
        
        onSaved?.(result.sourceId);
      } else {
        throw new Error(result.error || 'Save failed');
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
  
  const handleQuickSave = async () => {
    if (!isUnlocked) {
      setOpen(true);
      return;
    }
    
    setSaving(true);
    
    try {
      const key = getMasterKey();
      if (!key) throw new Error('No encryption key');
      
      const result = await saveWebSourceToMemory(source, key, { fetchFullContent: true });
      
      if (result.success) {
        setSaved(true);
        toast({
          title: 'Saved to memory',
          description: `"${source.title}" added to your knowledge base`
        });
        onSaved?.(result.sourceId);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Open save dialog for more options',
        variant: 'destructive'
      });
      setOpen(true);
    } finally {
      setSaving(false);
    }
  };
  
  if (saved) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-green-600">
        <Check className="h-4 w-4 mr-1" />
        Saved
      </Button>
    );
  }
  
  if (variant === 'icon') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickSave();
            }}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Save to Memory
            </DialogTitle>
            <DialogDescription>
              Add this source to your personal knowledge base.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{source.title}</p>
                  <p className="text-xs text-muted-foreground">{source.domain}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {source.trustLevel}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {(source.trustScore * 100).toFixed(0)}% trust
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fetchFull"
                checked={fetchFullContent}
                onCheckedChange={(checked) => setFetchFullContent(checked as boolean)}
              />
              <Label htmlFor="fetchFull" className="text-sm">
                Fetch full article content (recommended)
              </Label>
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
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Your notes (optional)</Label>
              <Textarea
                placeholder="Add your notes about this source..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Save to Memory
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus className="h-4 w-4 mr-2" />
          Save to Memory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Save to Memory
          </DialogTitle>
          <DialogDescription>
            Add this source to your personal knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{source.title}</p>
                <p className="text-xs text-muted-foreground">{source.domain}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {source.trustLevel}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {(source.trustScore * 100).toFixed(0)}% trust
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fetchFullBtn"
              checked={fetchFullContent}
              onCheckedChange={(checked) => setFetchFullContent(checked as boolean)}
            />
            <Label htmlFor="fetchFullBtn" className="text-sm">
              Fetch full article content (recommended)
            </Label>
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
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Your notes (optional)</Label>
            <Textarea
              placeholder="Add your notes about this source..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save to Memory
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
