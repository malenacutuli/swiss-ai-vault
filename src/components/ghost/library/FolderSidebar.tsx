import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, FolderPlus, Folder, FolderOpen, Pencil, Trash2, Check } from "@/icons";

interface FolderItem {
  id: string;
  name: string;
  item_count?: number;
}

interface FolderSidebarProps {
  folders: FolderItem[];
  selectedFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  onClose: () => void;
  onCreate?: (name: string) => Promise<any>;
  onRename?: (id: string, name: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}

export function FolderSidebar({
  folders,
  selectedFolder,
  onSelectFolder,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: FolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    if (onCreate) {
      await onCreate(newFolderName.trim());
    }
    setNewFolderName("");
    setIsCreating(false);
  };

  const handleStartRename = (folder: FolderItem) => {
    setEditingId(folder.id);
    setEditingName(folder.name);
  };

  const handleRename = async () => {
    if (!editingId || !editingName.trim()) return;
    if (onRename) {
      await onRename(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async () => {
    if (!deletingFolder) return;
    if (onDelete) {
      await onDelete(deletingFolder.id);
      if (selectedFolder === deletingFolder.id) {
        onSelectFolder(null);
      }
    }
    setDeletingFolder(null);
  };

  return (
    <div className="w-64 border-r border-border/40 bg-muted/20 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/40">
        <span className="text-sm font-medium">Folders</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All items */}
          <Button
            variant={selectedFolder === null ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 h-9"
            onClick={() => onSelectFolder(null)}
          >
            <FolderOpen className="h-4 w-4" />
            <span>All Items</span>
          </Button>

          {/* Folders list */}
          {folders.map((folder) => (
            <div key={folder.id} className="group flex items-center gap-1">
              {editingId === folder.id ? (
                <div className="flex-1 flex items-center gap-1 px-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditingName("");
                      }
                    }}
                    onBlur={handleRename}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleRename}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                    className="flex-1 justify-start gap-2 h-9"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{folder.name}</span>
                    {folder.item_count !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">{folder.item_count}</span>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-foreground/50 hover:text-foreground transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(folder);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-foreground/50 hover:text-destructive transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingFolder(folder);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
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
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create folder button */}
      <div className="p-2 border-t border-border/40">
        <Button variant="outline" className="w-full gap-2 h-9" onClick={() => setIsCreating(true)}>
          <FolderPlus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingFolder} onOpenChange={() => setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"? Items in this folder will not be deleted but will be moved to "All Items".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
