import { useState, useEffect } from 'react';
import { FileText, Check, Search } from 'lucide-react';
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
      // Use documentId for filtering since that's the grouping key
      const available = groups.filter(
        (group) => !existingDocIds.some(id => group.chunkIds.includes(id) || group.documentId === id)
      );
      setAllDocs(available);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDocs = allDocs.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function toggleDocument(docId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
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
        // Find the document group and add all its chunks to the project
        const group = allDocs.find(g => g.documentId === docId);
        if (group) {
          // Add the first chunk ID as the document reference
          await addDocumentToProject(projectId, group.chunkIds[0], key);
        }
      }
      onAdded();
      onOpenChange(false);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Documents to Project</DialogTitle>
          <DialogDescription>
            Select documents from your memory to add to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[300px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm text-center">
                {allDocs.length === 0
                  ? 'No documents in memory. Upload documents first.'
                  : 'No matching documents found.'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.documentId}
                  onClick={() => toggleDocument(doc.documentId)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    selectedIds.has(doc.documentId)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  <Checkbox
                    checked={selectedIds.has(doc.documentId)}
                    onCheckedChange={() => toggleDocument(doc.documentId)}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isAdding}
          >
            {isAdding
              ? 'Adding...'
              : `Add ${selectedIds.size} Document${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
