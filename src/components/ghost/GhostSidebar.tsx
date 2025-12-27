import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SwissBadge } from '@/components/ui/swiss';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { GhostModeToggle } from '@/components/ghost/GhostModeToggle';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  MessageSquare,
  Clock,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Settings,
  MoreHorizontal,
  Trash2,
  Download,
  Edit3,
  User,
  Zap,
  X,
  Menu,
  Image as ImageIcon,
  Check,
  FolderInput,
} from 'lucide-react';

export interface GhostConversation {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  isTemporary?: boolean;
  folderId?: string;
}

export interface GhostFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  isOpen?: boolean;
}

interface GhostSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: GhostConversation[];
  folders: GhostFolder[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: (isTemporary?: boolean) => void;
  onDeleteConversation: (id: string) => void;
  onExportConversation: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onMoveToFolder?: (convId: string, folderId: string | null) => void;
  onCreateFolder: () => void;
  onRenameFolder?: (id: string, name: string) => Promise<boolean>;
  onDeleteFolder?: (id: string) => Promise<boolean>;
  userName?: string;
  userCredits?: number;
  isPro?: boolean;
  onOpenSettings: () => void;
}

export function GhostSidebar({
  isOpen,
  onToggle,
  conversations,
  folders,
  selectedConversation,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onExportConversation,
  onRenameConversation,
  onMoveToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  userName = 'User',
  userCredits = 0,
  isPro = false,
  onOpenSettings,
}: GhostSidebarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Editing states
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by folder
  const { folderedChats, unfolderedChats } = useMemo(() => {
    const foldered: Record<string, GhostConversation[]> = {};
    const unfoldered: GhostConversation[] = [];

    for (const conv of filteredConversations) {
      if (conv.folderId) {
        if (!foldered[conv.folderId]) {
          foldered[conv.folderId] = [];
        }
        foldered[conv.folderId].push(conv);
      } else {
        unfoldered.push(conv);
      }
    }

    return { folderedChats: foldered, unfolderedChats: unfoldered };
  }, [filteredConversations]);

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSaveFolderName = async (folderId: string) => {
    if (onRenameFolder && editingFolderName.trim()) {
      await onRenameFolder(folderId, editingFolderName.trim());
      // Toast handled by useGhostFolders hook
    }
    setEditingFolderId(null);
  };

  const handleSaveChatTitle = (chatId: string) => {
    if (onRenameConversation && editingChatTitle.trim()) {
      onRenameConversation(chatId, editingChatTitle.trim());
      toast.success('Chat renamed');
    }
    setEditingChatId(null);
  };

  const handleMoveToFolder = (convId: string, folderId: string | null) => {
    if (onMoveToFolder) {
      onMoveToFolder(convId, folderId);
      const folderName = folderId 
        ? folders.find(f => f.id === folderId)?.name || 'folder'
        : 'Chats';
      toast.success(`Moved to ${folderName}`);
    }
  };

  const renderChatItem = (conv: GhostConversation, isNested = false) => (
    <div
      key={conv.id}
      onClick={() => onSelectConversation(conv.id)}
      className={cn(
        'group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors',
        isNested && 'ml-4',
        selectedConversation === conv.id
          ? 'bg-primary/10 text-foreground'
          : 'text-foreground/80 hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {conv.isTemporary ? (
          <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        ) : (
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        
        {editingChatId === conv.id ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={editingChatTitle}
              onChange={(e) => setEditingChatTitle(e.target.value)}
              onBlur={() => handleSaveChatTitle(conv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveChatTitle(conv.id);
                if (e.key === 'Escape') setEditingChatId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="h-5 text-xs px-1 py-0"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveChatTitle(conv.id);
              }}
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setEditingChatId(null);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <span className="text-sm truncate">{conv.title}</span>
        )}
      </div>

      {editingChatId !== conv.id && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Edit */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setEditingChatId(conv.id);
              setEditingChatTitle(conv.title);
            }}
          >
            <Edit3 className="w-3 h-3" />
          </Button>
          
          {/* Export */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onExportConversation(conv.id);
            }}
          >
            <Download className="w-3 h-3" />
          </Button>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover border-border">
              {/* Move to Folder */}
              {folders.length > 0 && onMoveToFolder && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                    <FolderInput className="w-3 h-3" />
                    Move to Folder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover border-border">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToFolder(conv.id, null);
                      }}
                      className="gap-2 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      No Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {folders.map(folder => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveToFolder(conv.id, folder.id);
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <Folder className="w-3 h-3" />
                        {folder.name}
                        {conv.folderId === folder.id && (
                          <Check className="w-3 h-3 ml-auto" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  const renderFolderItem = (folder: GhostFolder) => {
    const folderChats = folderedChats[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);
    const folderColor = folder.color || '#6366f1';

    return (
      <div key={folder.id} className="ml-1">
        <div
          className="group flex items-center justify-between px-2 py-1.5 rounded-md text-foreground/80 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => toggleFolderExpanded(folder.id)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Expand/Collapse Arrow */}
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
            
            <Folder 
              className="w-4 h-4 flex-shrink-0" 
              style={{ color: folderColor }}
            />
            
            {editingFolderId === folder.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                <Input
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onBlur={() => handleSaveFolderName(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveFolderName(folder.id);
                    if (e.key === 'Escape') setEditingFolderId(null);
                  }}
                  autoFocus
                  className="h-6 text-xs px-2 py-0"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 flex-shrink-0"
                  onClick={() => handleSaveFolderName(folder.id)}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 flex-shrink-0"
                  onClick={() => setEditingFolderId(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm truncate font-medium">{folder.name}</span>
                <span className="text-xs text-muted-foreground ml-auto pr-1">
                  {folderChats.length}
                </span>
              </>
            )}
          </div>

          {editingFolderId !== folder.id && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              {/* Edit */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              
              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={async () => {
                  if (onDeleteFolder) {
                    await onDeleteFolder(folder.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Nested chats */}
        {isExpanded && (
          <div className="space-y-0.5 mt-0.5 ml-4 pl-2 border-l border-border/50">
            {folderChats.length > 0 ? (
              folderChats.map(conv => renderChatItem(conv, true))
            ) : (
              <p className="text-xs text-muted-foreground italic py-1 px-2">Empty folder</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out',
          isOpen ? 'w-[280px]' : 'w-0 lg:w-0 overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-border">
          {/* Brand */}
          <Link
            to="/ghost"
            className="flex items-center gap-2 mb-4"
            onClick={() => isOpen && onToggle()}
          >
            <SwissFlag className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-foreground">
              SwissVault<span className="text-brand-accent">.ai</span>
            </span>
          </Link>

          {/* Ghost/Vault Toggle */}
          <div className="mb-4">
            <GhostModeToggle currentMode="ghost" />
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0 text-sm"
            />
          </div>

          {/* New Chat Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Chat
                </span>
                <ChevronDown className="w-4 h-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[248px] bg-popover border-border">
              <DropdownMenuItem onClick={() => onNewChat(false)} className="gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" />
                <div>
                  <p className="font-medium">Normal Chat</p>
                  <p className="text-xs text-muted-foreground">Saved locally with encryption</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNewChat(true)} className="gap-2 cursor-pointer">
                <Clock className="w-4 h-4" />
                <div>
                  <p className="font-medium">Temporary Chat</p>
                  <p className="text-xs text-muted-foreground">Deleted when you close the tab</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Folders Section */}
            <Collapsible open={foldersOpen} onOpenChange={setFoldersOpen} className="mb-2">
              <div className="flex items-center justify-between w-full px-2 py-1.5 bg-muted/30 rounded-md">
                <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  {foldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Folder className="w-3 h-3" />
                  <span>Folders</span>
                  {folders.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/70">({folders.length})</span>
                  )}
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder();
                  }}
                  title="Create new folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <CollapsibleContent className="pt-1">
                {folders.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-muted-foreground italic">
                    No folders yet. Click + to create one.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {folders.map(folder => renderFolderItem(folder))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Chats Section (unfolderd only) */}
            <Collapsible open={chatsOpen} onOpenChange={setChatsOpen} className="mt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                <div className="flex items-center gap-2">
                  {chatsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>Chats</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {unfolderedChats.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    {searchQuery ? 'No matching chats' : 'No chats yet'}
                  </p>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {unfolderedChats.map(conv => renderChatItem(conv))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Library Link */}
            <div className="mt-4 px-2 space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/ghost/library')}
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm">Library</span>
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* User Profile Footer */}
        <div className="flex-shrink-0 p-3 border-t border-border">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{userName}</span>
                  {isPro && (
                    <SwissBadge variant="private" size="sm">PRO</SwissBadge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  <span>{userCredits.toLocaleString()} credits</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenSettings}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Toggle button for mobile */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 left-4 z-50 lg:hidden',
          isOpen && 'hidden'
        )}
        onClick={onToggle}
      >
        <Menu className="w-5 h-5" />
      </Button>
    </>
  );
}