import { useState, useMemo, useEffect } from 'react';
import { Plus, Star, Trash2, Edit2, Check, X, Bot, Pencil, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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

const NOTES_STORAGE_KEY = 'swissbrain-studio-notes';

export interface Note {
  id: string;
  content: string;
  source: 'ai' | 'user';
  sourceQuery?: string;
  timestamp: Date;
  starred: boolean;
}

type FilterType = 'all' | 'ai' | 'user' | 'starred';

interface NotesPanelProps {
  notes: Note[];
  onAddNote: (content: string, source: 'ai' | 'user', sourceQuery?: string) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  onToggleStar: (id: string) => void;
}

export function NotesPanel({
  notes,
  onAddNote,
  onDeleteNote,
  onUpdateNote,
  onToggleStar,
}: NotesPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Persist notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      if (filter === 'all') return true;
      if (filter === 'ai') return note.source === 'ai';
      if (filter === 'user') return note.source === 'user';
      if (filter === 'starred') return note.starred;
      return true;
    });
  }, [notes, filter]);

  // Add new note
  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    onAddNote(newNoteContent.trim(), 'user');
    setNewNoteContent('');
  };

  // Start editing
  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  // Save edit
  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      onUpdateNote(editingId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // Confirm delete
  const confirmDelete = () => {
    if (deleteId) {
      onDeleteNote(deleteId);
      setDeleteId(null);
    }
  };

  const filters: Array<{ key: FilterType; label: string; count: number }> = [
    { key: 'all', label: 'All', count: notes.length },
    { key: 'ai', label: 'AI Saved', count: notes.filter(n => n.source === 'ai').length },
    { key: 'user', label: 'Your Notes', count: notes.filter(n => n.source === 'user').length },
    { key: 'starred', label: 'Starred', count: notes.filter(n => n.starred).length },
  ];

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with filters */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <StickyNote className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No notes yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save AI responses or add your own
              </p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  note.source === 'ai' 
                    ? 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900' 
                    : 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900',
                  note.starred && 'ring-2 ring-amber-400 ring-offset-1'
                )}
              >
                {/* Note header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {note.source === 'ai' ? (
                      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Bot className="w-3 h-3" />
                        AI
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <Pencil className="w-3 h-3" />
                        You
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {note.timestamp.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleStar(note.id)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        note.starred 
                          ? 'text-amber-500' 
                          : 'text-muted-foreground hover:text-amber-500'
                      )}
                    >
                      <Star className={cn('w-4 h-4', note.starred && 'fill-current')} />
                    </button>
                    <button
                      onClick={() => startEdit(note)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(note.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Note content */}
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[80px] text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {note.content}
                  </p>
                )}

                {/* Source query if AI note */}
                {note.source === 'ai' && note.sourceQuery && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    In response to: "{note.sourceQuery}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add note input */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex gap-2">
          <Textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <Button
            onClick={handleAddNote}
            disabled={!newNoteContent.trim()}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
