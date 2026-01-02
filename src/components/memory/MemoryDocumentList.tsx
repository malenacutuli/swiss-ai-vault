import { useState } from 'react';
import { 
  FileText, 
  StickyNote, 
  MessageSquare, 
  Globe, 
  MoreVertical,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { DocumentGroup, MemorySource } from '@/lib/memory/memory-store';

interface MemoryDocumentListProps {
  documents: DocumentGroup[];
  isLoading?: boolean;
  onDeleteDocument: (chunkIds: string[], filename: string) => Promise<void>;
  onViewChunks?: (documentId: string) => void;
}

const sourceConfig: Record<MemorySource, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: 'Document', color: 'text-blue-500' },
  note: { icon: StickyNote, label: 'Note', color: 'text-amber-500' },
  chat: { icon: MessageSquare, label: 'Chat', color: 'text-green-500' },
  url: { icon: Globe, label: 'Web', color: 'text-purple-500' }
};

export function MemoryDocumentList({ 
  documents, 
  isLoading,
  onDeleteDocument,
  onViewChunks 
}: MemoryDocumentListProps) {
  const [showAll, setShowAll] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ chunkIds: string[]; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  
  const displayedDocs = showAll ? documents : documents.slice(0, 5);
  
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await onDeleteDocument(deleteConfirm.chunkIds, deleteConfirm.filename);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };
  
  const getSourceIcon = (source: MemorySource) => {
    const config = sourceConfig[source] || sourceConfig.document;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (documents.length === 0) {
    return null;
  }
  
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Documents ({documents.length})
            </CardTitle>
            {documents.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show Less' : `Show All (${documents.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className={showAll && documents.length > 10 ? 'max-h-[400px]' : undefined}>
            <div className="space-y-2">
              {displayedDocs.map(doc => (
                <div 
                  key={doc.documentId}
                  className="group flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => setExpandedDoc(expandedDoc === doc.documentId ? null : doc.documentId)}
                      className="p-1.5 rounded hover:bg-background/50 transition-colors"
                    >
                      {expandedDoc === doc.documentId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="p-2 rounded bg-primary/10">
                      {getSourceIcon(doc.source)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.chunkCount} {doc.chunkCount === 1 ? 'chunk' : 'chunks'} • {sourceConfig[doc.source]?.label || 'Document'} • {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {doc.chunkCount} items
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                        {onViewChunks && (
                          <DropdownMenuItem onClick={() => onViewChunks(doc.documentId)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Chunks
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => setDeleteConfirm({ chunkIds: doc.chunkIds, filename: doc.filename })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirm?.filename}" and all {deleteConfirm?.chunkIds.length} of its chunks from your memory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}