import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  FolderPlus, 
  Folder, 
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2
} from '@/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Folder {
  id: string;
  name: string;
  item_count: number;
}

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  onClose: () => void;
}

export function FolderSidebar({
  folders,
  selectedFolder,
  onSelectFolder,
  onClose,
}: FolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    // TODO: Create folder in database
    setNewFolderName('');
    setIsCreating(false);
  };

  return (
    <div className="w-64 border-r border-border/40 bg-muted/20 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/40">
        <span className="text-sm font-medium">Folders</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All items */}
          <Button
            variant={selectedFolder === null ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 h-9"
            onClick={() => onSelectFolder(null)}
          >
            <FolderOpen className="h-4 w-4" />
            <span>All Items</span>
          </Button>

          {/* Folders list */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group flex items-center"
            >
              <Button
                variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                className="flex-1 justify-start gap-2 h-9"
                onClick={() => onSelectFolder(folder.id)}
              >
                <Folder className="h-4 w-4" />
                <span className="truncate">{folder.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {folder.item_count}
                </span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted rounded-md"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label="Folder actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Create folder input */}
          {isCreating && (
            <div className="flex items-center gap-1 px-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create folder button */}
      <div className="p-2 border-t border-border/40">
        <Button
          variant="outline"
          className="w-full gap-2 h-9"
          onClick={() => setIsCreating(true)}
        >
          <FolderPlus className="h-4 w-4" />
          New Folder
        </Button>
      </div>
    </div>
  );
}
