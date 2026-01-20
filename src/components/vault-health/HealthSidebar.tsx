import React, { useState, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
  Edit3,
  MoreVertical,
  FileText,
  Clock,
  Shield,
  Infinity,
  Brain,
  Activity,
  Check,
  X,
  Paperclip,
  File,
  FileImage,
  FileSpreadsheet,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RetentionMode } from '@/lib/health/health-storage';
import { ConversationSummary } from '@/hooks/useHealthStorage';

// Task type options for healthcare
const TASK_TYPES = [
  { value: 'general_query', label: 'General Query', description: 'General healthcare questions' },
  { value: 'prior_auth_review', label: 'Prior Auth Review', description: 'Review prior authorization requests' },
  { value: 'claims_appeal', label: 'Claims Appeal', description: 'Analyze denials and prepare appeals' },
  { value: 'icd10_lookup', label: 'ICD-10 Lookup', description: 'Search diagnosis codes' },
  { value: 'drug_interaction', label: 'Drug Interaction', description: 'Check medication interactions' },
  { value: 'literature_search', label: 'Literature Search', description: 'Search medical literature' },
  { value: 'clinical_documentation', label: 'Clinical Documentation', description: 'Documentation assistance' },
  { value: 'care_coordination', label: 'Care Coordination', description: 'Care team coordination' },
];

// Retention mode options
const RETENTION_MODES: { value: RetentionMode; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'forever', label: 'Forever', icon: Infinity, description: 'Data persists indefinitely' },
  { value: '90days', label: '90 Days', icon: Clock, description: 'Auto-expires after 90 days' },
  { value: 'zerotrace', label: 'Zero Trace', icon: Shield, description: 'Deleted when browser closes' },
];

interface AttachedDoc {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface HealthFolder {
  id: string;
  name: string;
}

interface HealthSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: ConversationSummary[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;

  // Current conversation settings
  currentTaskType: string;
  onTaskTypeChange: (type: string) => void;
  currentRetentionMode: RetentionMode;
  onRetentionModeChange: (mode: RetentionMode) => void;
  memoryEnabled: boolean;
  onMemoryEnabledChange: (enabled: boolean) => void;

  // Folders
  folders?: HealthFolder[];
  selectedFolder?: string | null;
  onSelectFolder?: (id: string | null) => void;
  onCreateFolder?: () => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveToFolder?: (conversationId: string, folderId: string | null) => void;

  // Attached documents for current conversation
  attachedDocuments?: AttachedDoc[];
  onRemoveDocument?: (docId: string) => void;

  // Settings
  onOpenSettings?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return FileSpreadsheet;
  return File;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const HealthSidebar = memo(function HealthSidebar({
  isOpen,
  onToggle,
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  currentTaskType,
  onTaskTypeChange,
  currentRetentionMode,
  onRetentionModeChange,
  memoryEnabled,
  onMemoryEnabledChange,
  attachedDocuments = [],
  onRemoveDocument,
  onOpenSettings,
}: HealthSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const handleSaveTitle = (id: string) => {
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const currentRetention = RETENTION_MODES.find(r => r.value === currentRetentionMode);
  const RetentionIcon = currentRetention?.icon || Clock;

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
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border/60 transition-all duration-200',
          isOpen ? 'w-72' : 'w-0 lg:w-16',
          !isOpen && 'overflow-hidden max-lg:hidden'
        )}
      >
        {/* Header */}
        <div className="p-3 border-b border-border/40 flex items-center justify-between">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#1D4E5F]" />
                <span className="font-semibold text-sm">Health Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onToggle}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
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
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand Sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>

        {isOpen && (
          <>
            {/* New Conversation Button */}
            <div className="p-3 border-b border-border/40">
              <Button
                onClick={onNewConversation}
                className="w-full bg-[#1D4E5F] hover:bg-[#1D4E5F]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            </div>

            {/* Quick Navigation Links */}
            <div className="p-3 border-b border-border/40">
              <div className="px-1 mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Quick Access
                </span>
              </div>
              <div className="space-y-1">
                <Link to="/ghost/projects">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Projects
                  </Button>
                </Link>
                <Link to="/ghost/memory">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Memory
                  </Button>
                </Link>
                <Link to="/ghost/research-library">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Research Library
                  </Button>
                </Link>
              </div>
            </div>

            {/* Settings Panel */}
            <div className="p-3 border-b border-border/40 space-y-3">
              {/* Task Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Task Type</Label>
                <Select value={currentTaskType} onValueChange={onTaskTypeChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value} className="text-xs">
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-muted-foreground text-[10px]">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Retention Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Retention</Label>
                <Select value={currentRetentionMode} onValueChange={(v) => onRetentionModeChange(v as RetentionMode)}>
                  <SelectTrigger className="h-8 text-xs">
                    <div className="flex items-center gap-2">
                      <RetentionIcon className="w-3.5 h-3.5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {RETENTION_MODES.map(mode => {
                      const Icon = mode.icon;
                      return (
                        <SelectItem key={mode.value} value={mode.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <div>
                              <div className="font-medium">{mode.label}</div>
                              <div className="text-muted-foreground text-[10px]">{mode.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Memory Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-xs">Use Memory</Label>
                </div>
                <Switch
                  checked={memoryEnabled}
                  onCheckedChange={onMemoryEnabledChange}
                  className="scale-75"
                />
              </div>
            </div>

            {/* Attached Documents */}
            {attachedDocuments.length > 0 && (
              <div className="p-3 border-b border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Attached Documents</span>
                  <span className="text-xs text-muted-foreground">({attachedDocuments.length})</span>
                </div>
                <div className="space-y-1">
                  {attachedDocuments.map(doc => {
                    const DocIcon = getFileIcon(doc.mimeType);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-1.5 rounded bg-muted/50 group"
                      >
                        <DocIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{doc.filename}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(doc.size)}</p>
                        </div>
                        {onRemoveDocument && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onRemoveDocument(doc.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Conversations
                  </span>
                </div>

                {filteredConversations.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                    {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                  </p>
                ) : (
                  filteredConversations.map(conv => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                        selectedConversation === conv.id
                          ? 'bg-[#1D4E5F]/10 text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />

                      {editingId === conv.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(conv.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="h-6 text-xs px-2 flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleSaveTitle(conv.id)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium">{conv.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{conv.messageCount} msgs</span>
                              {conv.documentCount > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" />
                                  {conv.documentCount}
                                </span>
                              )}
                              <span>{formatTimeAgo(conv.updatedAt)}</span>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(conv.id);
                                  setEditingTitle(conv.title);
                                }}
                              >
                                <Edit3 className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(conv.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            {onOpenSettings && (
              <div className="p-3 border-t border-border/40">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs"
                  onClick={onOpenSettings}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            )}
          </>
        )}

        {/* Collapsed state icons */}
        {!isOpen && (
          <div className="flex flex-col items-center gap-2 p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={onNewConversation}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Conversation</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={onToggle}
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Conversations ({conversations.length})</TooltipContent>
            </Tooltip>

            {attachedDocuments.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onToggle}>
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Documents ({attachedDocuments.length})</TooltipContent>
              </Tooltip>
            )}

            {onOpenSettings && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 mt-auto" onClick={onOpenSettings}>
                    <Settings className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </aside>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) {
                  onDeleteConversation(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
});

export default HealthSidebar;
