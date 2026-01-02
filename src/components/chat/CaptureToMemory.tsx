import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookmarkPlus, Brain, Sparkles, Tag, X } from '@/icons';
import { useMemory } from '@/hooks/useMemory';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface Props {
  message: Message;
  previousMessage?: Message;
  conversationTitle?: string;
  onCaptured?: () => void;
  className?: string;
}

// Topic detection keywords
const TOPIC_KEYWORDS: [string, string[]][] = [
  ['code', ['programming', 'function', 'api', 'bug', 'error', 'typescript', 'javascript', 'python', 'react']],
  ['design', ['ui', 'ux', 'layout', 'color', 'component', 'interface', 'style']],
  ['business', ['strategy', 'market', 'revenue', 'growth', 'customer', 'product']],
  ['writing', ['content', 'blog', 'article', 'copy', 'text', 'document']],
  ['data', ['analysis', 'chart', 'metric', 'insight', 'database', 'query']],
  ['legal', ['contract', 'compliance', 'policy', 'regulation', 'law']],
  ['finance', ['budget', 'cost', 'investment', 'revenue', 'money', 'price']],
  ['security', ['encryption', 'password', 'auth', 'privacy', 'secure']],
];

export function CaptureToMemory({ message, previousMessage, conversationTitle, onCaptured, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const { addNote, isReady } = useMemory();
  const { isUnlocked, getMasterKey } = useEncryptionContext();
  
  // Auto-generate title from content
  const generateTitle = useCallback(() => {
    const content = message.content;
    const firstLine = content.split('\n')[0];
    const firstSentence = firstLine.split(/[.!?]/)[0];
    return firstSentence.slice(0, 60) + (firstSentence.length > 60 ? '...' : '');
  }, [message.content]);
  
  // Auto-suggest tags from content
  const suggestTags = useCallback((): string[] => {
    const content = (message.content + ' ' + (previousMessage?.content || '')).toLowerCase();
    const suggestions: string[] = [];
    
    TOPIC_KEYWORDS.forEach(([main, keywords]) => {
      if (keywords.some(k => content.includes(k))) {
        suggestions.push(main);
      }
    });
    
    return suggestions.slice(0, 3);
  }, [message.content, previousMessage?.content]);
  
  const handleOpen = () => {
    setTitle(generateTitle());
    setTags(suggestTags());
    setNotes('');
    setIsOpen(true);
  };
  
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };
  
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  const handleCapture = async () => {
    if (!isUnlocked) {
      toast.error('Memory vault is locked');
      return;
    }

    const encryptionKey = getMasterKey();
    if (!encryptionKey) {
      toast.error('Encryption key not available');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Build full content with context
      const fullContent = [
        previousMessage ? `**Question:** ${previousMessage.content}\n\n` : '',
        `**Answer:**\n${message.content}`,
        notes ? `\n\n**My Notes:**\n${notes}` : '',
        `\n\n---\n_Captured from: ${conversationTitle || 'SwissVault Chat'}_`,
        tags.length > 0 ? `\n_Tags: ${tags.join(', ')}_` : ''
      ].join('');
      
      const result = await addNote(fullContent, title || generateTitle());
      
      if (result) {
        toast.success('Captured to memory!');
        setIsOpen(false);
        onCaptured?.();
      } else {
        toast.error('Failed to capture - vault may be locked');
      }
    } catch (err) {
      console.error('[CaptureToMemory] Error:', err);
      toast.error('Failed to capture');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Don't render if memory not ready
  if (!isReady && !isUnlocked) {
    return null;
  }
  
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={className}
        title="Capture to Memory"
      >
        <BookmarkPlus className="w-3.5 h-3.5" />
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Capture to Memory
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this insight a name..."
              />
            </div>
            
            {/* Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Preview</label>
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2 max-h-32 overflow-y-auto">
                {previousMessage && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Q:</span> {previousMessage.content.slice(0, 100)}
                    {previousMessage.content.length > 100 && '...'}
                  </p>
                )}
                <p>
                  <span className="font-medium">A:</span> {message.content.slice(0, 200)}
                  {message.content.length > 200 && '...'}
                </p>
              </div>
            </div>
            
            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags yet</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add a tag..."
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
            
            {/* Personal Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this important? What will you do with this?"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCapture} disabled={isSaving || !isUnlocked}>
              {isSaving ? (
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Save to Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
