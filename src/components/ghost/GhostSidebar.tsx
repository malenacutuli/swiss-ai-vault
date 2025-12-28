import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Trash2,
  Download,
  Edit3,
  X,
  Menu,
  Image as ImageIcon,
  Check,
  Home,
} from 'lucide-react';
import { GhostModeToggle } from './GhostModeToggle';

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);

  // Drag + drop
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingChat, setIsDraggingChat] = useState(false);

  // Editing states
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');

  // Expanded state = sidebar open OR hovered
  const isExpanded = isOpen || isHovered;

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { folderedChats, unfolderedChats } = useMemo(() => {
    const foldered: Record<string, GhostConversation[]> = {};
    const unfoldered: GhostConversation[] = [];

    for (const conv of filteredConversations) {
      if (conv.folderId) {
        if (!foldered[conv.folderId]) foldered[conv.folderId] = [];
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
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleSaveFolderName = async (folderId: string) => {
    if (onRenameFolder && editingFolderName.trim()) {
      await onRenameFolder(folderId, editingFolderName.trim());
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
      draggable={isExpanded}
      onDragStart={(e) => {
        setIsDraggingChat(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-ghost-conversation-id', conv.id);
      }}
      onDragEnd={() => {
        setIsDraggingChat(false);
        setDragOverFolderId(null);
      }}
      onClick={() => onSelectConversation(conv.id)}
      className={cn(
        'group/chat flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors duration-150',
        isNested && 'ml-4',
        selectedConversation === conv.id
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        isDraggingChat && 'select-none'
      )}
    >
      {conv.isTemporary ? (
        <Clock className="w-4 h-4 text-warning shrink-0" />
      ) : (
        <MessageSquare className="w-4 h-4 shrink-0" />
      )}
      
      {isExpanded && (
        editingChatId === conv.id ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={editingChatTitle}
              onChange={(e) => setEditingChatTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveChatTitle(conv.id);
                if (e.key === 'Escape') setEditingChatId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="h-6 text-xs px-2 flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); handleSaveChatTitle(conv.id); }}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); setEditingChatId(null); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-[13px] truncate flex-1">{conv.title}</span>
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/chat:opacity-100 transition-opacity duration-150">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); setEditingChatId(conv.id); setEditingChatTitle(conv.title); }}
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); onExportConversation(conv.id); }}
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );

  const renderFolderItem = (folder: GhostFolder) => {
    const folderChats = folderedChats[folder.id] || [];
    const isFolderExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'group/folder flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors duration-150',
            dragOverFolderId === folder.id ? 'bg-primary/10' : 'hover:bg-muted/50',
            'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => isExpanded && toggleFolderExpanded(folder.id)}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDragEnter={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
          onDragLeave={() => setDragOverFolderId(prev => prev === folder.id ? null : prev)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverFolderId(null);
            const convId = e.dataTransfer.getData('application/x-ghost-conversation-id');
            if (convId) {
              handleMoveToFolder(convId, folder.id);
              setExpandedFolders(prev => new Set(prev).add(folder.id));
            }
          }}
        >
          <Folder className="w-4 h-4 shrink-0" style={{ color: folder.color || 'currentColor' }} />
          
          {isExpanded && (
            editingFolderId === folder.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                <Input
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveFolderName(folder.id);
                    if (e.key === 'Escape') setEditingFolderId(null);
                  }}
                  autoFocus
                  className="h-6 text-xs px-2 flex-1"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleSaveFolderName(folder.id)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingFolderId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-[13px] truncate flex-1">{folder.name}</span>
                {isFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/folder:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:text-destructive hover:bg-destructive/10"
                    onClick={async () => { if (onDeleteFolder) await onDeleteFolder(folder.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </>
            )
          )}
        </div>

        {isExpanded && isFolderExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {folderChats.length > 0 ? (
              folderChats.map(conv => renderChatItem(conv, true))
            ) : (
              <p className="text-xs text-muted-foreground italic py-1 px-6">Empty</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const IconButton = ({ icon: Icon, label, onClick, active = false }: { icon: any; label: string; onClick: () => void; active?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 w-full px-2 py-2 rounded-lg transition-colors duration-150',
            active 
              ? 'bg-muted text-foreground' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {isExpanded && <span className="text-[13px] truncate">{label}</span>}
        </button>
      </TooltipTrigger>
      {!isExpanded && (
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border/60 transition-all duration-200 ease-out',
          isExpanded ? 'w-64' : 'w-14',
          !isOpen && 'max-lg:hidden'
        )}
      >
        {/* Ghost/Vault Toggle */}
        {isExpanded && (
          <div className="p-3 border-b border-border/40">
            <GhostModeToggle currentMode="ghost" />
          </div>
        )}

        {/* Top navigation */}
        <div className="flex flex-col gap-1 p-2">
          {/* New Chat */}
          <IconButton 
            icon={Plus} 
            label="New Chat" 
            onClick={() => onNewChat(false)} 
          />

          {/* New Folder */}
          <IconButton 
            icon={FolderPlus} 
            label="New Folder" 
            onClick={onCreateFolder} 
          />
          
          {/* Home */}
          <IconButton 
            icon={Home} 
            label="Home" 
            onClick={() => navigate('/')} 
          />

          {/* Search - only when expanded */}
          {isExpanded && (
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-muted/40 border-0 text-[13px] rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1 px-2">
          {isExpanded ? (
            <div className="space-y-1">
              {/* Folders */}
              {folders.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Folders</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-muted"
                      onClick={onCreateFolder}
                    >
                      <FolderPlus className="w-3 h-3" />
                    </Button>
                  </div>
                  {folders.map(folder => renderFolderItem(folder))}
                </div>
              )}

              {/* Chats */}
              <div className="space-y-0.5 mt-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Chats</span>
                  {folders.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-muted"
                      onClick={onCreateFolder}
                    >
                      <FolderPlus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {unfolderedChats.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {searchQuery ? 'No matches' : 'No chats yet'}
                  </p>
                ) : (
                  unfolderedChats.map(conv => renderChatItem(conv))
                )}
              </div>
            </div>
          ) : (
            // Collapsed: show recent chat icons
            <div className="flex flex-col gap-1 py-2">
              {unfolderedChats.slice(0, 5).map(conv => (
                <Tooltip key={conv.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectConversation(conv.id)}
                      className={cn(
                        'flex items-center justify-center w-full p-2 rounded-lg transition-colors duration-150',
                        selectedConversation === conv.id
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {conv.isTemporary ? <Clock className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {conv.title}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Bottom navigation */}
        <div className="flex flex-col gap-1 p-2 border-t border-border/60">
          <IconButton 
            icon={ImageIcon} 
            label="Library" 
            onClick={() => navigate('/ghost/library')} 
          />
          <IconButton 
            icon={Settings} 
            label="Settings" 
            onClick={onOpenSettings} 
          />
        </div>
      </aside>

      {/* Mobile toggle button */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-40 lg:hidden bg-background/80 border border-border/60"
          onClick={onToggle}
        >
          <Menu className="w-5 h-5" />
        </Button>
      )}
    </TooltipProvider>
  );
}