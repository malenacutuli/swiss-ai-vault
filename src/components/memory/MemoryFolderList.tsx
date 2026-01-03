import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Folder,
  FolderPlus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MemoryFolder {
  id: string;
  name: string;
  parentId: string | null;
  itemCount?: number;
}

interface MemoryFolderListProps {
  folders: MemoryFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  totalItems?: number;
}

export function MemoryFolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  totalItems = 0
}: MemoryFolderListProps) {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<MemoryFolder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const rootFolders = folders.filter(f => f.parentId === null);
  const categorizedCount = folders.reduce((acc, f) => acc + (f.itemCount || 0), 0);
  const uncategorizedCount = totalItems - categorizedCount;
  
  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreateFolder(newFolderName.trim(), null);
      setNewFolderName('');
      setShowCreateDialog(false);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleRename = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    
    setIsCreating(true);
    try {
      await onRenameFolder(editingFolder.id, newFolderName.trim());
      setNewFolderName('');
      setShowRenameDialog(false);
      setEditingFolder(null);
    } finally {
      setIsCreating(false);
    }
  };
  
  const openRenameDialog = (folder: MemoryFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setShowRenameDialog(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{t('memory.folders.title')}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowCreateDialog(true)}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="max-h-[200px]">
        <div className="space-y-1">
          {/* All Items */}
          <button
            onClick={() => onSelectFolder(null)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
              selectedFolderId === null 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted"
            )}
          >
            <FileText className="h-4 w-4" />
            <span className="flex-1 text-left">{t('memory.documents.filter.all', 'Todos')}</span>
            <Badge variant="secondary" className="text-xs">{totalItems}</Badge>
          </button>
          
          {/* Uncategorized */}
          {uncategorizedCount > 0 && (
            <button
              onClick={() => onSelectFolder('uncategorized')}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedFolderId === 'uncategorized'
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted"
              )}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{t('memory.folders.uncategorized')}</span>
              <Badge variant="secondary" className="text-xs">{uncategorizedCount}</Badge>
            </button>
          )}
          
          {/* Folders */}
          {rootFolders.map((folder) => (
            <div key={folder.id} className="flex items-center gap-1">
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                  selectedFolderId === folder.id 
                    ? "bg-primary/10 text-primary" 
                    : "hover:bg-muted"
                )}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left truncate">{folder.name}</span>
                {folder.itemCount !== undefined && (
                  <Badge variant="secondary" className="text-xs">{folder.itemCount}</Badge>
                )}
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                  <DropdownMenuItem onClick={() => openRenameDialog(folder)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('memory.folders.rename')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteFolder(folder.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('memory.folders.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* Create Folder Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('memory.folders.newFolder')}</DialogTitle>
            <DialogDescription>
              {t('memory.folders.createDescription', 'Organiza tus elementos de memoria en carpetas.')}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder={t('memory.folders.namePlaceholder', 'Nombre de la carpeta')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newFolderName.trim()}>
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('memory.folders.rename')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('memory.folders.namePlaceholder', 'Nombre de la carpeta')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={isCreating || !newFolderName.trim()}>
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('memory.folders.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
