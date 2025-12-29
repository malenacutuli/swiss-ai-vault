// GhostSidebar v2 - Centralized Icons
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  IconSearch,
  IconPlus,
  IconMessage,
  IconClock,
  IconFolder,
  IconFolderPlus,
  IconChevronDown,
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebar,
  IconSettings,
  IconTrash,
  IconDownload,
  IconEdit,
  IconX,
  IconMenu2,
  IconPhoto,
  IconCheck,
  IconHome,
  IconDotsVertical,
  IconTrendingUp,
  IconScale,
  IconBulb,
  IconBook2,
  IconShield,
  IconPlane,
  IconActivity,
  IconCompass,
  EyeOff,
} from '@/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GhostModeToggle } from './GhostModeToggle';
import { GhostCustomizeSidebar } from './GhostCustomizeSidebar';

// ============================================
// CHAT ACTIONS MENU
// ============================================
interface ChatActionsMenuProps {
  conversationId: string;
  conversationTitle: string;
  onRename: (id: string, title: string) => void;
  onExport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function ChatActionsMenu({
  conversationId,
  conversationTitle,
  onRename,
  onExport,
  onDelete,
}: ChatActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted rounded-md"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          aria-label="Chat actions"
        >
          <IconDotsVertical className="w-4 h-4" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="z-50 min-w-[160px] bg-popover text-popover-foreground border border-border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRename(conversationId, conversationTitle);
          }}
        >
          <IconEdit className="h-4 w-4 mr-2" />
          Rename
        </DropdownMenuItem>

        {onExport && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onExport(conversationId);
            }}
          >
            <IconDownload className="h-4 w-4 mr-2" />
            Download
          </DropdownMenuItem>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversationId);
              }}
            >
              <IconTrash className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// FOLDER ACTIONS MENU
// ============================================
interface FolderActionsMenuProps {
  folderId: string;
  folderName: string;
  onRename: (id: string, name: string) => void;
  onExport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function FolderActionsMenu({
  folderId,
  folderName,
  onRename,
  onExport,
  onDelete,
}: FolderActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted rounded-md"
        onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          aria-label="Folder actions"
        >
          <IconDotsVertical className="w-4 h-4" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="z-50 min-w-[160px] bg-popover text-popover-foreground border border-border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRename(folderId, folderName);
          }}
        >
          <IconEdit className="h-4 w-4 mr-2" />
          Rename
        </DropdownMenuItem>

        {onExport && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onExport(folderId);
            }}
          >
            <IconDownload className="h-4 w-4 mr-2" />
            Download All
          </DropdownMenuItem>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folderId);
              }}
            >
              <IconTrash className="h-4 w-4 mr-2" />
              Delete Folder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Discover module definitions - IDs for translation keys
interface DiscoverModule {
  id: string;
  nameKey: string;
  icon: any;
  descriptionKey: string;
  route: string;
  isPro?: boolean;
}

const ALL_DISCOVER_MODULES: DiscoverModule[] = [
  { id: 'finance', nameKey: 'ghost.modules.finance.title', icon: IconTrendingUp, descriptionKey: 'ghost.modules.finance.description', route: '/ghost/finance' },
  { id: 'legal', nameKey: 'ghost.modules.legal.title', icon: IconScale, descriptionKey: 'ghost.modules.legal.description', route: '/ghost/legal' },
  { id: 'patents', nameKey: 'ghost.modules.patents.title', icon: IconBulb, descriptionKey: 'ghost.modules.patents.description', route: '/ghost/patents' },
  { id: 'research', nameKey: 'ghost.modules.research.title', icon: IconBook2, descriptionKey: 'ghost.modules.research.description', route: '/ghost/research' },
  { id: 'security', nameKey: 'ghost.modules.security.title', icon: IconShield, descriptionKey: 'ghost.modules.security.description', route: '/ghost/security' },
  { id: 'health', nameKey: 'ghost.modules.health.title', icon: IconActivity, descriptionKey: 'ghost.modules.health.description', route: '/ghost/health', isPro: true },
  { id: 'travel', nameKey: 'ghost.modules.travel.title', icon: IconPlane, descriptionKey: 'ghost.modules.travel.description', route: '/ghost/travel', isPro: true },
  { id: 'realestate', nameKey: 'ghost.modules.realestate.title', icon: IconHome, descriptionKey: 'ghost.modules.realestate.description', route: '/ghost/realestate', isPro: true },
];

const DEFAULT_ENABLED_MODULES = ['finance', 'legal', 'patents', 'research'];

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
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: (isTemporary?: boolean) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onExportConversation: (id: string) => void;
  onOpenSettings: () => void;
  activeModule?: string;
  userName?: string;
  userCredits?: number;
  isPro?: boolean;
  // Folder support
  folders?: GhostFolder[];
  onCreateFolder?: () => void;
  onDeleteFolder?: (id: string) => Promise<boolean | void>;
  onRenameFolder?: (id: string, name: string) => void;
  onMoveToFolder?: (conversationId: string, folderId: string | null) => void;
  onExportFolder?: (folderId: string) => void;
}

export function GhostSidebar({
  isOpen,
  onToggle,
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onExportConversation,
  onOpenSettings,
  activeModule,
  folders = [],
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveToFolder,
  onExportFolder,
}: GhostSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>(() => {
    const saved = localStorage.getItem('ghost-discover-modules');
    return saved ? JSON.parse(saved) : DEFAULT_ENABLED_MODULES;
  });
  
  // Drag and drop state
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const isExpanded = isOpen || isHovered;

  // Compute visible and hidden modules based on enabled state
  const { visibleModules, hiddenModules } = useMemo(() => {
    const visible = ALL_DISCOVER_MODULES.filter(m => enabledModules.includes(m.id));
    const hidden = ALL_DISCOVER_MODULES.filter(m => !enabledModules.includes(m.id));
    return { visibleModules: visible, hiddenModules: hidden };
  }, [enabledModules]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  // Group conversations by folder
  const { folderedChats, unfolderedChats } = useMemo(() => {
    const foldered: Record<string, GhostConversation[]> = {};
    const unfoldered: GhostConversation[] = [];
    
    folders.forEach(f => { foldered[f.id] = []; });
    
    filteredConversations.forEach(conv => {
      if (conv.folderId && foldered[conv.folderId]) {
        foldered[conv.folderId].push(conv);
      } else {
        unfoldered.push(conv);
      }
    });
    
    return { folderedChats: foldered, unfolderedChats: unfoldered };
  }, [filteredConversations, folders]);

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

  const handleSaveChatTitle = (id: string) => {
    if (editingChatTitle.trim()) {
      onRenameConversation(id, editingChatTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleSaveFolderName = (id: string) => {
    if (editingFolderName.trim() && onRenameFolder) {
      onRenameFolder(id, editingFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const handleMoveToFolder = (convId: string, folderId: string | null) => {
    if (onMoveToFolder) {
      onMoveToFolder(convId, folderId);
      toast.success(folderId ? t('ghost.sidebar.movedToFolder') : t('ghost.sidebar.movedToChats'));
    }
  };

  // Chat item drag handlers
  const handleChatDragStart = (e: React.DragEvent, convId: string) => {
    e.dataTransfer.setData('application/x-ghost-conversation-id', convId);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingChat(true);
  };

  const handleChatDragEnd = () => {
    setIsDraggingChat(false);
    setDragOverFolderId(null);
  };

  // Render individual chat item
  const renderChatItem = (conv: GhostConversation, isNested = false) => (
    <div
      key={conv.id}
      draggable={!!onMoveToFolder}
      onDragStart={(e) => handleChatDragStart(e, conv.id)}
      onDragEnd={handleChatDragEnd}
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
        <IconClock className="w-4 h-4 text-warning shrink-0" strokeWidth={1.5} />
      ) : (
        <IconMessage className="w-4 h-4 shrink-0" strokeWidth={1.5} />
      )}
      
      {isExpanded && (
        editingChatId === conv.id ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={editingChatTitle}
              onChange={(e) => setEditingChatTitle(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleSaveChatTitle(conv.id);
                if (e.key === 'Escape') setEditingChatId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              autoFocus
              className="h-6 text-xs px-2 flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); handleSaveChatTitle(conv.id); }}
            >
              <IconCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); setEditingChatId(null); }}
            >
              <IconX className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-[13px] truncate flex-1">{conv.title}</span>
            
            <ChatActionsMenu
              conversationId={conv.id}
              conversationTitle={conv.title}
              onRename={(id, title) => { setEditingChatId(id); setEditingChatTitle(title); }}
              onExport={onExportConversation}
              onDelete={onDeleteConversation}
            />
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
          <IconFolder className="w-4 h-4 shrink-0" strokeWidth={1.5} style={{ color: folder.color || 'currentColor' }} />
          
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
                  <IconCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingFolderId(null)}>
                  <IconX className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-[13px] truncate">{folder.name}</span>
                  {isFolderExpanded ? <IconChevronDown className="w-3 h-3 shrink-0" strokeWidth={1.5} /> : <IconChevronRight className="w-3 h-3 shrink-0" strokeWidth={1.5} />}
                </div>

                <FolderActionsMenu
                  folderId={folder.id}
                  folderName={folder.name}
                  onRename={(id, name) => {
                    setEditingFolderId(id);
                    setEditingFolderName(name);
                  }}
                  onExport={onExportFolder}
                  onDelete={onDeleteFolder ? async (id) => {
                    try {
                      await onDeleteFolder(id);
                      toast.success('Folder deleted');
                    } catch (error) {
                      console.error('Delete folder error:', error);
                      toast.error('Failed to delete folder');
                    }
                  } : undefined}
                />
              </>
            )
          )}
        </div>

        {isExpanded && isFolderExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {folderChats.length > 0 ? (
              folderChats.map(conv => renderChatItem(conv, true))
            ) : (
              <p className="text-xs text-muted-foreground italic py-1 px-6">{t('ghost.sidebar.empty')}</p>
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
            'transition-colors duration-150',
            isExpanded 
              ? cn(
                  'flex items-center gap-3 w-full px-2 py-2 rounded-lg',
                  active 
                    ? 'bg-muted text-foreground' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )
              : cn(
                  'flex flex-col items-center justify-center gap-1 py-2 w-full rounded-lg',
                  active 
                    ? 'bg-muted text-foreground' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {isExpanded ? (
            <span className="text-[13px] truncate">{label}</span>
          ) : (
            <span className="text-[10px] font-medium truncate w-full text-center px-1">{label}</span>
          )}
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
          isExpanded ? 'w-64' : 'w-20',
          !isOpen && 'max-lg:hidden'
        )}
      >
        {/* Header with Toggle */}
        <div className="p-3 border-b border-border/40 flex items-center justify-between">
          {isExpanded ? (
            <>
              <GhostModeToggle currentMode="ghost" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onToggle}
                  >
                    <IconLayoutSidebarLeftCollapse className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('ghost.sidebar.collapseSidebar')}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mx-auto"
                  onClick={onToggle}
                >
                  <IconLayoutSidebar className="w-4 h-4" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('ghost.sidebar.expandSidebar')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Top navigation */}
        <div className={cn("flex flex-col p-2", isExpanded ? "gap-1" : "gap-2 items-center")}>
          {/* New Chat with dropdown */}
          {isExpanded ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 px-2 py-2 h-auto text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  <IconPlus className="w-5 h-5 shrink-0" />
                  <span className="text-[13px] truncate flex-1 text-left">{t('ghost.sidebar.newChat')}</span>
                  <IconChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
                <DropdownMenuItem onClick={() => onNewChat(false)} className="flex items-start gap-3 py-2.5">
                  <IconMessage className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{t('ghost.sidebar.normalChat', 'Normal Chat')}</span>
                    <span className="text-xs text-muted-foreground">{t('ghost.sidebar.normalChatDesc', 'Saved to your device')}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNewChat(true)} className="flex items-start gap-3 py-2.5">
                  <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{t('ghost.sidebar.incognitoChat', 'Incognito Chat')}</span>
                    <span className="text-xs text-muted-foreground">{t('ghost.sidebar.incognitoChatDesc', 'Deleted when you leave')}</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <IconButton 
              icon={IconPlus} 
              label={t('ghost.sidebar.newChat')} 
              onClick={() => onNewChat(false)} 
            />
          )}

          {/* New Folder */}
          <IconButton 
            icon={IconFolderPlus} 
            label={t('ghost.sidebar.newFolder')} 
            onClick={onCreateFolder} 
          />
          
          {/* Home */}
          <IconButton 
            icon={IconHome} 
            label={t('ghost.sidebar.home')} 
            onClick={() => navigate('/')} 
          />

          {/* Search - only when expanded */}
          {isExpanded && (
            <div className="relative mt-2">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              <Input
                type="text"
                placeholder={t('ghost.sidebar.searchPlaceholder')}
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
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('ghost.sidebar.folders')}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-muted"
                      onClick={onCreateFolder}
                    >
                      <IconFolderPlus className="w-3 h-3" strokeWidth={1.5} />
                    </Button>
                  </div>
                  {folders.map(folder => renderFolderItem(folder))}
                </div>
              )}

              {/* Chats */}
              <div className="space-y-0.5 mt-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('ghost.sidebar.chats')}</span>
                  {folders.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-muted"
                      onClick={onCreateFolder}
                    >
                      <IconFolderPlus className="w-3 h-3" strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
                {unfolderedChats.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {searchQuery ? t('ghost.sidebar.noMatches') : t('ghost.sidebar.noChatsYet')}
                  </p>
                ) : (
                  unfolderedChats.map(conv => renderChatItem(conv))
                )}
              </div>
            </div>
          ) : (
            // Collapsed: show Folders/Chats with text labels (Perplexity-style)
            <div className="flex flex-col items-center gap-1 py-2">
              {folders.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggle}
                      className="flex flex-col items-center justify-center gap-1 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                      <IconFolder className="w-5 h-5" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium truncate w-full text-center px-1">{t('ghost.sidebar.folders')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>{t('ghost.sidebar.folders')}</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="flex flex-col items-center justify-center gap-1 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <IconMessage className="w-5 h-5" strokeWidth={1.5} />
                    <span className="text-[10px] font-medium truncate w-full text-center px-1">{t('ghost.sidebar.chats')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>{t('ghost.sidebar.chats')}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </ScrollArea>

        {/* Discover Section */}
        <div className="border-t border-border/40 p-2">
          {isExpanded && (
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <IconCompass className="w-3 h-3" strokeWidth={1.5} />
                {t('ghost.sidebar.discover')}
              </span>
            </div>
          )}
          
          <div className={cn("space-y-0.5", !isExpanded && "flex flex-col items-center gap-1")}>
            {visibleModules.map((module) => {
              const isActive = activeModule === module.id || location.pathname === module.route;
              const Icon = module.icon;
              
              return (
                <Tooltip key={module.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(module.route)}
                      className={cn(
                        "transition-all",
                        isExpanded
                          ? cn(
                              "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm",
                              isActive
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )
                          : cn(
                              "flex flex-col items-center justify-center gap-1 py-2 w-full rounded-lg",
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {isExpanded ? (
                        <>
                          <span className="truncate flex-1 text-left text-[13px]">{t(module.nameKey)}</span>
                          {module.isPro && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              PRO
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] font-medium truncate w-full text-center px-1">{t(module.nameKey)}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" sideOffset={8}>
                      <div>
                        <div className="font-medium">{t(module.nameKey)}</div>
                        <div className="text-xs text-muted-foreground">{t(module.descriptionKey)}</div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
            
            {/* More Menu */}
            {hiddenModules.length > 0 && (
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className={cn(
                        "transition-all",
                        isExpanded 
                          ? "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          : "flex flex-col items-center justify-center gap-1 py-2 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <IconDotsVertical className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                      {isExpanded ? (
                        <span className="text-[13px]">{t('ghost.sidebar.more')}</span>
                      ) : (
                        <span className="text-[10px] font-medium">{t('ghost.sidebar.more')}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" sideOffset={8}>{t('ghost.sidebar.more')}</TooltipContent>
                  )}
                </Tooltip>
                
                {showMoreMenu && isExpanded && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-1 z-50">
                    {hiddenModules.map((module) => {
                      const Icon = module.icon;
                      return (
                        <button
                          key={module.id}
                          onClick={() => {
                            navigate(module.route);
                            setShowMoreMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{t(module.nameKey)}</span>
                          {module.isPro && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium ml-auto">
                              PRO
                            </span>
                          )}
                        </button>
                      );
                    })}
                    
                    <div className="border-t border-border/60 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowCustomizeModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded"
                      >
                        <IconSettings className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{t('ghost.sidebar.customizeSidebar')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom navigation */}
        <div className={cn("flex flex-col p-2 border-t border-border/60", isExpanded ? "gap-1" : "gap-2 items-center")}>
          <IconButton 
            icon={IconPhoto} 
            label={t('ghost.sidebar.library')} 
            onClick={() => navigate('/ghost/library')} 
          />
          <IconButton 
            icon={IconSettings} 
            label={t('ghost.sidebar.settings')} 
            onClick={onOpenSettings} 
          />
        </div>
      </aside>

      {/* Customize Modal */}
      <GhostCustomizeSidebar
        open={showCustomizeModal}
        onOpenChange={setShowCustomizeModal}
        enabledModules={enabledModules}
        onSave={(modules) => {
          setEnabledModules(modules);
          localStorage.setItem('ghost-discover-modules', JSON.stringify(modules));
        }}
      />

      {/* Mobile toggle button */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-40 lg:hidden bg-background/80 border border-border/60"
          onClick={onToggle}
        >
          <IconMenu2 className="w-5 h-5" strokeWidth={1.5} />
        </Button>
      )}
    </TooltipProvider>
  );
}
