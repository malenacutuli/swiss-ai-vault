import { useState, useMemo } from 'react';
import { 
  FileText, 
  StickyNote, 
  MessageSquare, 
  Globe, 
  MoreVertical,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FolderInput,
  Folder,
  FolderOpen,
  Search,
  SortAsc,
  SortDesc,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DocumentGroup, MemorySource } from '@/lib/memory/memory-store';
import { cn } from '@/lib/utils';

interface MemoryDocumentListProps {
  documents: DocumentGroup[];
  chats?: DocumentGroup[];
  folders: Array<{ id: string; name: string }>;
  isLoading?: boolean;
  onDeleteDocument: (chunkIds: string[], filename: string) => Promise<void>;
  onViewChunks?: (documentId: string) => void;
  onMoveToFolder: (chunkIds: string[], folderId: string | null) => Promise<void>;
}

const sourceConfig: Record<MemorySource, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: 'Document', color: 'text-blue-500' },
  note: { icon: StickyNote, label: 'Note', color: 'text-amber-500' },
  chat: { icon: MessageSquare, label: 'Chat', color: 'text-green-500' },
  url: { icon: Globe, label: 'Web', color: 'text-purple-500' }
};

const ITEMS_PER_PAGE = 20;

export function MemoryDocumentList({ 
  documents,
  chats = [],
  folders,
  isLoading,
  onDeleteDocument,
  onViewChunks,
  onMoveToFolder
}: MemoryDocumentListProps) {
  // Tab and filter state
  const [activeTab, setActiveTab] = useState<'all' | 'documents' | 'chats'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string | null>(null);
  
  // Delete dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{ chunkIds: string[]; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Move to folder dialog state
  const [moveToFolderDoc, setMoveToFolderDoc] = useState<{ chunkIds: string[]; filename: string } | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Separate documents from chats in the passed documents array
  const { docItems, chatItems } = useMemo(() => {
    const docs = documents.filter(d => d.source === 'document' || d.source === 'note' || d.source === 'url');
    const chatDocs = documents.filter(d => d.source === 'chat' || (d as any).aiPlatform);
    return { 
      docItems: docs,
      chatItems: [...chatDocs, ...chats]
    };
  }, [documents, chats]);
  
  // Combined and filtered items
  const filteredItems = useMemo(() => {
    let items: DocumentGroup[] = [];
    
    if (activeTab === 'all') {
      items = [...docItems, ...chatItems];
    } else if (activeTab === 'documents') {
      items = docItems;
    } else {
      items = chatItems;
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.filename.toLowerCase().includes(query)
      );
    }
    
    // Filter by folder
    if (selectedFolderFilter) {
      items = items.filter(item => (item as any).folderId === selectedFolderFilter);
    }
    
    // Sort
    items.sort((a, b) => {
      if (sortOrder === 'newest') return b.createdAt - a.createdAt;
      if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
      return a.filename.localeCompare(b.filename);
    });
    
    return items;
  }, [docItems, chatItems, activeTab, searchQuery, sortOrder, selectedFolderFilter]);
  
  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
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
  
  const handleMoveToFolder = async () => {
    if (!moveToFolderDoc) return;
    setIsMoving(true);
    try {
      await onMoveToFolder(moveToFolderDoc.chunkIds, selectedFolderId);
      setMoveToFolderDoc(null);
      setSelectedFolderId(null);
    } finally {
      setIsMoving(false);
    }
  };
  
  const getSourceIcon = (doc: DocumentGroup) => {
    // Check for AI platform first (chat imports)
    if ((doc as any).aiPlatform || doc.source === 'chat') {
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    }
    const config = sourceConfig[doc.source] || sourceConfig.document;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };
  
  const getSourceBadge = (doc: DocumentGroup) => {
    const platform = (doc as any).aiPlatform || doc.source;
    const colors: Record<string, string> = {
      claude: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
      chatgpt: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      gemini: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      document: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      note: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      url: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      chat: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    };
    return (
      <Badge variant="outline" className={cn("text-xs capitalize", colors[platform] || colors.document)}>
        {platform}
      </Badge>
    );
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const totalDocs = docItems.length;
  const totalChats = chatItems.length;
  const totalAll = totalDocs + totalChats;
  
  if (totalAll === 0) {
    return null;
  }
  
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Content
              <Badge variant="secondary" className="ml-1">
                {filteredItems.length} items
              </Badge>
            </CardTitle>
          </div>
          
          {/* Tabs for content type */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setCurrentPage(1); }}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                All ({totalAll})
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Documents ({totalDocs})
              </TabsTrigger>
              <TabsTrigger value="chats" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Chats ({totalChats})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Search and filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-9"
              />
            </div>
            
            {/* Folder filter */}
            {folders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    {selectedFolderFilter 
                      ? folders.find(f => f.id === selectedFolderFilter)?.name || 'Folder'
                      : 'All Folders'
                    }
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                  <DropdownMenuItem onClick={() => { setSelectedFolderFilter(null); setCurrentPage(1); }}>
                    All Folders
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {folders.map(folder => (
                    <DropdownMenuItem 
                      key={folder.id} 
                      onClick={() => { setSelectedFolderFilter(folder.id); setCurrentPage(1); }}
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1">
                  {sortOrder === 'newest' ? <SortDesc className="h-3.5 w-3.5" /> : <SortAsc className="h-3.5 w-3.5" />}
                  {sortOrder === 'name' ? 'A-Z' : sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                <DropdownMenuItem onClick={() => setSortOrder('newest')}>
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('name')}>
                  Name (A-Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Items list */}
          <div className="space-y-2">
            {paginatedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No items match your search' : 'No items found'}
              </div>
            ) : (
              paginatedItems.map((doc) => (
                <div 
                  key={doc.documentId}
                  className="group flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded bg-primary/10 shrink-0">
                      {getSourceIcon(doc)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{doc.filename}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{doc.chunkCount} chunks</span>
                        <span>•</span>
                        <span>{formatDate(doc.createdAt)}</span>
                        {(doc as any).folderId && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Folder className="h-3 w-3" />
                              {folders.find(f => f.id === (doc as any).folderId)?.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getSourceBadge(doc)}
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">
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
                        <DropdownMenuItem onClick={() => setMoveToFolderDoc({ chunkIds: doc.chunkIds, filename: doc.filename })}>
                          <FolderInput className="h-4 w-4 mr-2" />
                          Move to Folder
                        </DropdownMenuItem>
                        {onViewChunks && (
                          <DropdownMenuItem onClick={() => onViewChunks(doc.documentId)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Chunks
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteConfirm({ chunkIds: doc.chunkIds, filename: doc.filename })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
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
      
      {/* Move to Folder Dialog */}
      <Dialog open={!!moveToFolderDoc} onOpenChange={(open) => !open && setMoveToFolderDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Choose a destination folder for "{moveToFolderDoc?.filename}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                selectedFolderId === null 
                  ? "bg-primary/10 border border-primary" 
                  : "bg-muted/50 hover:bg-muted border border-transparent"
              )}
            >
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Root (No Folder)</p>
                <p className="text-xs text-muted-foreground">Remove from all folders</p>
              </div>
            </button>
            
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                  selectedFolderId === folder.id 
                    ? "bg-primary/10 border border-primary" 
                    : "bg-muted/50 hover:bg-muted border border-transparent"
                )}
              >
                <Folder className="h-5 w-5 text-primary" />
                <p className="font-medium">{folder.name}</p>
              </button>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToFolderDoc(null)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToFolder} disabled={isMoving}>
              {isMoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isMoving ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
