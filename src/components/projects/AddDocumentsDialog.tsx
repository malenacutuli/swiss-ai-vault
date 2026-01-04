import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, FileText, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getDocumentGroups, addDocumentToProject, type DocumentGroup } from '@/lib/memory/memory-store';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingDocIds: string[];
  onAdded: () => void;
}

export function AddDocumentsDialog({
  open,
  onOpenChange,
  projectId,
  existingDocIds,
  onAdded,
}: AddDocumentsDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getMasterKey } = useEncryptionContext();
  const [allDocs, setAllDocs] = useState<DocumentGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadDocuments();
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  async function loadDocuments() {
    setIsLoading(true);
    try {
      const key = await getMasterKey();
      if (!key) return;
      
      const groups = await getDocumentGroups(key);
      // Filter to only show documents not already in project
      const available = groups.filter(
        (group) => !existingDocIds.some(id => group.chunkIds.includes(id) || group.documentId === id)
      );
      setAllDocs(available);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return allDocs;
    const query = searchQuery.toLowerCase();
    return allDocs.filter((doc) => doc.filename.toLowerCase().includes(query));
  }, [allDocs, searchQuery]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    try {
      const key = await getMasterKey();
      if (!key) return;
      
      for (const docId of selectedIds) {
        const group = allDocs.find(g => g.documentId === docId);
        if (group) {
          await addDocumentToProject(projectId, group.chunkIds[0], key);
        }
      }
      toast({ title: t('projects.addDocs.addedCount', 'Added {{count}} document(s)').replace('{{count}}', String(selectedIds.size)) });
      onAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t('projects.addDocs.addFailed', 'Failed to add documents'), variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('projects.addDocs.title', 'Add Documents to Project')}</DialogTitle>
          <DialogDescription>
            {t('projects.addDocs.description', 'Select documents from your memory to add to this project.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('projects.addDocs.searchPlaceholder', 'Search documents...')}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">{t('common.loading', 'Loading...')}</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('projects.addDocs.noDocuments', 'No documents available')}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.documentId}
                    onClick={() => toggleSelection(doc.documentId)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                      selectedIds.has(doc.documentId)
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(doc.documentId)}
                      onCheckedChange={() => toggleSelection(doc.documentId)}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.source} • {doc.chunkCount} chunks
                      </p>
                    </div>
                    {selectedIds.has(doc.documentId) && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedIds.size > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {t('projects.addDocs.selectedCount', '{{count}} document(s) selected').replace('{{count}}', String(selectedIds.size))}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0 || isAdding}>
            {isAdding ? t('projects.addDocs.adding', 'Adding...') : t('projects.addDocs.addButton', 'Add {{count}} Document(s)').replace('{{count}}', String(selectedIds.size || ''))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
