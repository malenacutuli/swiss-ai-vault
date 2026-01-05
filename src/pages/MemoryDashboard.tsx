// src/pages/MemoryDashboard.tsx
// Memory Dashboard for Personal AI Memory management

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Brain, 
  FileText, 
  MessageSquare,
  StickyNote, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Plus,
  Loader2,
  HardDrive,
  AlertCircle,
  Globe,
  MoreVertical,
  Settings,
  ArrowLeft,
  Network,
  Link2,
  Mic,
  Headphones,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useMemory, type ContextSnippet } from '@/hooks/useMemory';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { useToast } from '@/hooks/use-toast';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';
import { MemorySyncSettings } from '@/components/memory/MemorySyncSettings';
import { SyncStatusIndicator } from '@/components/memory/SyncStatusIndicator';
import { MemoryRestoreDialog } from '@/components/memory/MemoryRestoreDialog';
import { MemoryErrorBoundary } from '@/components/memory/MemoryErrorBoundary';
import { MemoryLoadingState } from '@/components/memory/MemoryLoadingState';
import { MemoryOfflineIndicator } from '@/components/memory/MemoryOfflineIndicator';
import { MemoryFolderList } from '@/components/memory/MemoryFolderList';
import { BulkUploadDialog } from '@/components/memory/BulkUploadDialog';
import { MemoryOnboarding } from '@/components/memory/MemoryOnboarding';
import { DistillInsightsButton } from '@/components/memory/DistillInsightsButton';
import { ConnectorSettings } from '@/components/memory/ConnectorSettings';
import { MemoryGraph } from '@/components/memory/MemoryGraph';
import { InsightsPanel, type InsightsPanelRef } from '@/components/memory/InsightsPanel';
import { MemoryQuickStart } from '@/components/memory/MemoryQuickStart';
import { ImportAIHistoryModal } from '@/components/memory/ImportChatGPTModal';
import { MemoryDocumentList } from '@/components/memory/MemoryDocumentList';
import { VoiceNotesPanel } from '@/components/memory/VoiceNotesPanel';
import { AudioBriefingsList } from '@/components/briefings/AudioBriefingsList';
import { MemoryMigrationDialog } from '@/components/memory/MemoryMigrationDialog';
import { useNewDeviceDetection } from '@/hooks/useNewDeviceDetection';
import { useMemoryOnboarding } from '@/hooks/useMemoryOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { useDistillationRunner } from '@/hooks/useDistillationRunner';
import { isPreviewEnvironment, getEnvironmentLabel } from '@/lib/memory/migration';
import type { MemoryFolder } from '@/lib/memory/memory-manager';

interface MemoryStats {
  count: number;
  sizeEstimateBytes: number;
  hotCacheSize: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

interface SourceBreakdown {
  document: number;
  note: number;
  chat: number;
  url: number;
}

interface DocumentGroup {
  documentId: string;
  filename: string;
  chunkCount: number;
  source: 'document' | 'note' | 'chat' | 'url';
  createdAt: number;
  chunkIds: string[];
}

function MemoryDashboardContent() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isUnlocked, isInitialized: vaultInitialized, getMasterKey } = useEncryptionContext();
  const memory = useMemory();
  const { shouldShowRestore, dismissRestore } = useNewDeviceDetection();
  const { showOnboarding, hasChecked, completeOnboarding, skipOnboarding, resetOnboarding } = useMemoryOnboarding();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContextSnippet[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  
  const [showUnlock, setShowUnlock] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  
  // Check if we're on a preview environment
  const isPreview = isPreviewEnvironment();
  const environmentLabel = getEnvironmentLabel();
  
  const [folders, setFolders] = useState<MemoryFolder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Map<string | null, number>>(new Map());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  // Document groups and source breakdown
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown>({ document: 0, note: 0, chat: 0, url: 0 });
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  
  // Use global distillation runner
  const { start: startDistillation } = useDistillationRunner();
  const insightsPanelRef = useRef<InsightsPanelRef>(null);
  
  // Wait for component to mount before rendering
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (isUnlocked && !memory.isInitialized) {
      memory.initialize();
    }
  }, [isUnlocked, memory.isInitialized, memory.initialize]);
  
  // Load stats, folders, and document groups
  useEffect(() => {
    if (memory.isReady) {
      memory.getStats().then(setStats);
      loadFolders();
      loadDocumentGroups();
    }
  }, [memory.isReady, memory.getStats]);
  
  const loadFolders = useCallback(async () => {
    try {
      const { getFolders, getFolderItemCounts } = await import('@/lib/memory/memory-manager');
      const key = getMasterKey();
      if (!key) return;
      
      const folderList = await getFolders();
      const counts = await getFolderItemCounts(key);
      
      setFolders(folderList.map(f => ({
        ...f,
        itemCount: counts.get(f.id) || 0
      })));
      setFolderCounts(counts);
    } catch (e) {
      console.error('Failed to load folders:', e);
    }
  }, [getMasterKey]);
  
  const loadDocumentGroups = useCallback(async () => {
    const key = getMasterKey();
    if (!key) return;
    
    setIsLoadingDocs(true);
    try {
      const { getDocumentGroups, getSourceBreakdown } = await import('@/lib/memory/memory-store');
      
      const [docs, breakdown] = await Promise.all([
        getDocumentGroups(key),
        getSourceBreakdown(key)
      ]);
      
      setDocumentGroups(docs);
      setSourceBreakdown(breakdown);
    } catch (e) {
      console.error('Failed to load document groups:', e);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [getMasterKey]);
  
  const handleDeleteDocument = useCallback(async (chunkIds: string[], filename: string) => {
    try {
      const { deleteDocumentChunks } = await import('@/lib/memory/memory-store');
      const deleted = await deleteDocumentChunks(chunkIds);
      toast({ title: 'Document deleted', description: `Removed ${deleted} chunks from ${filename}` });
      
      // Refresh stats and documents
      memory.getStats().then(setStats);
      loadDocumentGroups();
    } catch (error) {
      toast({ title: 'Delete failed', description: String(error), variant: 'destructive' });
    }
  }, [memory, toast, loadDocumentGroups]);
  
  const handleMoveToFolder = useCallback(async (chunkIds: string[], folderId: string | null) => {
    const key = getMasterKey();
    if (!key) {
      toast({ title: 'Vault locked', description: 'Please unlock your vault first', variant: 'destructive' });
      return;
    }
    
    try {
      const { moveDocumentsToFolder } = await import('@/lib/memory/memory-store');
      const result = await moveDocumentsToFolder(chunkIds, folderId, key);
      
      toast({ 
        title: 'Document moved', 
        description: `Moved ${result.moved} chunks to ${folderId ? 'folder' : 'root'}` 
      });
      
      // Refresh both folders and documents
      await loadFolders();
      await loadDocumentGroups();
    } catch (error) {
      toast({ 
        title: 'Move failed', 
        description: 'Could not move document to folder',
        variant: 'destructive'
      });
    }
  }, [getMasterKey, toast, loadFolders, loadDocumentGroups]);
  
  // Check if vault needs unlock
  useEffect(() => {
    if (vaultInitialized && !isUnlocked) {
      setShowUnlock(true);
    }
  }, [vaultInitialized, isUnlocked]);
  
  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !memory.isReady) return;
    
    setIsSearching(true);
    try {
      const results = await memory.search(searchQuery, { topK: 10 });
      setSearchResults(results);
    } catch (error) {
      toast({ title: 'Search failed', description: String(error), variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, memory, toast]);
  
  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !memory.isReady) return;
    
    try {
      const text = await file.text();
      const result = await memory.addDocument(text, file.name);
      
      if (result.success) {
        toast({ title: 'Document added', description: `${result.chunksAdded} chunks stored` });
        memory.getStats().then(setStats);
      } else {
        toast({ title: 'Failed to add document', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Upload failed', description: String(error), variant: 'destructive' });
    }
    
    // Reset input
    e.target.value = '';
  }, [memory, toast]);
  
  // Add note handler
  const handleAddNote = useCallback(async () => {
    if (!noteContent.trim() || !memory.isReady) return;
    
    setIsAddingNote(true);
    try {
      await memory.addNote(noteContent, noteTitle || 'Untitled Note');
      toast({ title: 'Note added to memory' });
      setShowAddNote(false);
      setNoteTitle('');
      setNoteContent('');
      memory.getStats().then(setStats);
    } catch (error) {
      toast({ title: 'Failed to add note', description: String(error), variant: 'destructive' });
    } finally {
      setIsAddingNote(false);
    }
  }, [noteTitle, noteContent, memory, toast]);
  
  // Distill insights handler - uses global runner for background processing
  const handleDistillInsights = useCallback(async (options?: { resume?: boolean }) => {
    const key = getMasterKey();
    if (!key) {
      toast({ title: 'Vault Locked', description: 'Please unlock your vault first', variant: 'destructive' });
      return;
    }

    // If resuming, just call the runner with resume flag
    if (options?.resume) {
      startDistillation([], { resume: true });
      return;
    }

    // Load memories and filter to unprocessed
    try {
      const { getAllMemoriesDecrypted } = await import('@/lib/memory/memory-store');
      const { getDistilledSourceIds } = await import('@/lib/memory/distill');

      const allMemories = await getAllMemoriesDecrypted(key);
      const distilledIds = await getDistilledSourceIds();
      
      // Filter to undistilled items with enough content
      const toProcess = allMemories
        .filter(m => {
          const isDistilled = distilledIds.has(m.id);
          const hasContent = m.content && m.content.length > 100;
          return !isDistilled && hasContent;
        })
        .map(m => ({
          id: m.id,
          title: m.metadata?.title || m.metadata?.filename || 'Untitled',
          content: m.content,
          source: m.metadata?.source || 'chat',
        }));

      if (toProcess.length === 0) {
        toast({ title: 'All Caught Up!', description: 'All content has been analyzed.' });
        return;
      }

      // Start the global runner
      startDistillation(toProcess);
      
    } catch (error) {
      console.error('Failed to start distillation:', error);
      toast({ title: 'Failed to start analysis', variant: 'destructive' });
    }
  }, [getMasterKey, toast, startDistillation]);
  
  // Export handler
  const handleExport = useCallback(async () => {
    try {
      const blob = await memory.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swissvault-memory-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Export failed', description: String(error), variant: 'destructive' });
    }
  }, [memory, toast]);
  
  // Import handler
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      await memory.importBackup(file);
      memory.getStats().then(setStats);
    } catch (error) {
      toast({ title: 'Import failed', description: String(error), variant: 'destructive' });
    }
    
    e.target.value = '';
  }, [memory, toast]);
  
  // Clear all handler
  const handleClearAll = useCallback(async () => {
    try {
      await memory.clearAll();
      setStats(null);
      setSearchResults([]);
    } catch (error) {
      toast({ title: 'Clear failed', description: String(error), variant: 'destructive' });
    }
    setShowClearConfirm(false);
  }, [memory, toast]);
  
  // Delete single item
  const handleDelete = useCallback(async (id: string) => {
    try {
      await memory.deleteItem(id);
      setSearchResults(prev => prev.filter(r => r.id !== id));
      memory.getStats().then(setStats);
      toast({ title: 'Item deleted' });
    } catch (error) {
      toast({ title: 'Delete failed', description: String(error), variant: 'destructive' });
    }
  }, [memory, toast]);
  
  // Folder handlers
  const handleCreateFolder = useCallback(async (name: string, parentId: string | null) => {
    const { createFolder } = await import('@/lib/memory/memory-manager');
    await createFolder({ name, parentId });
    await loadFolders();
    toast({ title: 'Folder created' });
  }, [loadFolders, toast]);
  
  const handleRenameFolder = useCallback(async (id: string, name: string) => {
    const { updateFolder } = await import('@/lib/memory/memory-manager');
    await updateFolder(id, { name });
    await loadFolders();
    toast({ title: 'Folder renamed' });
  }, [loadFolders, toast]);
  
  const handleDeleteFolder = useCallback(async (id: string) => {
    const { deleteFolder } = await import('@/lib/memory/memory-manager');
    await deleteFolder(id);
    await loadFolders();
    if (selectedFolderId === id) setSelectedFolderId(null);
    toast({ title: 'Folder deleted' });
  }, [loadFolders, selectedFolderId, toast]);
  
  // Bulk upload handler
  const handleBulkUpload = useCallback(async (
    files: Array<{ content: string; filename: string }>,
    folderId?: string
  ) => {
    const { addDocumentsBulk } = await import('@/lib/memory/memory-manager');
    const key = getMasterKey();
    if (!key) {
      toast({
        title: "Vault locked",
        description: "Please unlock your vault to upload documents",
        variant: "destructive"
      });
      throw new Error('No encryption key - vault is locked');
    }
    
    const result = await addDocumentsBulk(files, key, folderId);
    await memory.getStats().then(setStats);
    await loadFolders();
    await loadDocumentGroups();
    
    return { successful: result.successful, failed: result.failed };
  }, [getMasterKey, memory, loadFolders, loadDocumentGroups, toast]);
  
  // Source icon helper
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'chat': return <MessageSquare className="h-4 w-4" />;
      case 'note': return <StickyNote className="h-4 w-4" />;
      case 'url': return <Globe className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };
  
  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Loading state while mounting
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        {/* Back to Chat */}
        <button 
          onClick={() => navigate('/ghost')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')} {t('ghost.chat.title', 'Chat')}
        </button>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{t('memory.title')}</h1>
                <SyncStatusIndicator />
              </div>
              <p className="text-sm text-muted-foreground">{t('memory.dashboard.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DistillInsightsButton onComplete={() => memory.getStats().then(setStats)} />
            
            {/* Import AI History Button */}
            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
              <Download className="h-4 w-4 mr-2" />
              {t('common.import', 'Import')}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add', 'Add')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                <DropdownMenuItem onClick={() => setShowBulkUpload(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('memory.upload.bulkUpload')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    {t('memory.documents.title')}
                    <input
                      type="file"
                      accept=".txt,.md,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddNote(true)}>
                  <StickyNote className="h-4 w-4 mr-2" />
                  {t('memory.notes.addNote', 'Añadir nota')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('memory.dashboard.quickStart.importChats')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                <DropdownMenuItem onClick={() => setShowMigration(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {t('memory.migration.menuItem', 'Migrate Memory')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('memory.actions.exportMemory', 'Exportar memoria')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    {t('memory.actions.importMemory', 'Importar memoria')}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('memory.actions.clearAll', 'Limpiar toda la memoria')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Preview Environment Warning */}
        {isPreview && stats && stats.count > 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-6">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-600 dark:text-yellow-400">
              {t('memory.migration.previewWarning', 'Preview Environment')} ({environmentLabel})
            </AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-muted-foreground">
                {t('memory.migration.previewWarningDesc', "Memories created here won't be available on swissvault.ai. Use 'Migrate Memory' to export before switching.")}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                className="shrink-0 border-yellow-500/50 hover:bg-yellow-500/10"
                onClick={() => setShowMigration(true)}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {t('memory.migration.migrateNow', 'Migrate Now')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Tabs */}
        <Tabs defaultValue="memory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="memory" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t('memory.dashboard.tabs.all', 'Memoria')}
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              {t('memory.dashboard.tabs.voiceNotes', 'Notas de Voz')}
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              {t('memory.dashboard.tabs.audioBriefings', 'Audio Briefings')}
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {t('memory.dashboard.tabs.insights', 'Insights')}
            </TabsTrigger>
            <TabsTrigger value="graph" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              {t('memory.graph.title')}
            </TabsTrigger>
            <TabsTrigger value="connectors" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t('memory.connectors.title', 'Conectores')}
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('common.settings', 'Settings')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="memory" className="space-y-6">
            {/* Offline Indicator */}
            <MemoryOfflineIndicator />
            
            {/* Loading State */}
            {memory.isLoading && !memory.isInitialized && (
              <MemoryLoadingState
                stage={
                  memory.progress.percent < 20 ? 'initializing' : 
                  memory.progress.percent < 80 ? 'downloading' : 'loading'
                }
                progress={memory.progress.percent}
                message={memory.progress.message}
              />
            )}
            
            {/* Folder List */}
            {memory.isReady && (
              <Card>
                <CardContent className="pt-4">
                  <MemoryFolderList
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    totalItems={stats?.count || 0}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* Hero Import CTA - show when memory has few items */}
            {memory.isReady && (stats?.count || 0) < 10 && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="flex flex-col md:flex-row items-center gap-6 py-8">
                  <div className="p-4 rounded-2xl bg-primary/10">
                    <Brain className="h-12 w-12 text-primary" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-semibold mb-2">{t('memory.onboarding.buildMemory', 'Construye tu Memoria IA')}</h3>
                    <p className="text-muted-foreground">
                      {t('memory.onboarding.importDescription', 'Importa conversaciones de ChatGPT, Claude, Gemini, Perplexity y más. Tu IA recordará todo en todos tus chats.')}
                    </p>
                  </div>
                  <Button size="lg" onClick={() => setShowImportModal(true)}>
                    <Download className="h-5 w-5 mr-2" />
                    {t('memory.dashboard.quickStart.importChats')}
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Quick Start for Empty State */}
            {memory.isReady && stats?.count === 0 && (
              <MemoryQuickStart
                onUploadDocument={() => setShowBulkUpload(true)}
                onAddNote={() => setShowAddNote(true)}
                onGoToChat={() => navigate('/chat')}
                onViewTutorial={resetOnboarding}
              />
            )}
            
            {/* Stats Cards with Source Breakdown */}
            {stats && stats.count > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{stats.count}</div>
                    <div className="text-xs text-muted-foreground">{t('memory.stats.totalItems', 'Total')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-500">{documentGroups.length}</div>
                    <div className="text-xs text-muted-foreground">{t('memory.documents.title')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-500">{sourceBreakdown.document}</div>
                    <div className="text-xs text-muted-foreground">{t('memory.stats.chunks', 'Fragmentos')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-500">{sourceBreakdown.note}</div>
                    <div className="text-xs text-muted-foreground">{t('memory.notes.title', 'Notas')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-500">{sourceBreakdown.chat}</div>
                    <div className="text-xs text-muted-foreground">{t('memory.dashboard.tabs.chats')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-indigo-500">{sourceBreakdown.url}</div>
                    <div className="text-xs text-muted-foreground">URLs</div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Documents List */}
            {memory.isReady && (stats?.count || 0) > 0 && (
              <MemoryDocumentList
                documents={documentGroups}
                folders={folders}
                folderFilter={selectedFolderId}
                isLoading={isLoadingDocs}
                onDeleteDocument={handleDeleteDocument}
                onMoveToFolder={handleMoveToFolder}
              />
            )}
            
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('memory.search.title', 'Buscar en Memoria')}</CardTitle>
                <CardDescription>{t('memory.search.subtitle', 'Encuentra contenido relevante en tu base de conocimiento')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('memory.search.placeholder', 'Buscar en tu memoria...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={isSearching || !memory.isReady}>
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('common.search', 'Search')
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('memory.search.results', 'Resultados')} ({searchResults.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getSourceIcon(result.source)}
                              <span className="text-sm font-medium truncate">
                                {result.metadata.filename || 
                                 result.metadata.title || 
                                 'Memory Item'}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {(result.score * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {result.content}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(result.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
            
            {/* Empty State */}
            {memory.isReady && stats?.count === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">{t('memory.empty.title', 'Tu memoria IA está vacía')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('memory.empty.description', 'Añade documentos o notas para construir tu base de conocimiento personal.')}
                    </p>
                    <Button onClick={() => setShowAddNote(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('memory.empty.addFirst', 'Añadir tu primera nota')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="insights">
            <InsightsPanel
              ref={insightsPanelRef}
              totalItems={stats?.count || 0}
              totalChats={sourceBreakdown.chat}
              totalDocuments={documentGroups.length}
              onDistill={handleDistillInsights}
            />
          </TabsContent>
          
          
          <TabsContent value="graph">
            <MemoryGraph 
              memories={searchResults.length > 0 
                ? searchResults.map(r => ({
                    id: r.id,
                    title: r.metadata.title || r.metadata.filename || 'Memory Item',
                    source: r.source,
                    aiPlatform: (r.metadata as any).aiPlatform, // Pass AI platform for correct coloring
                    timestamp: typeof r.metadata.createdAt === 'number' 
                      ? new Date(r.metadata.createdAt).toISOString() 
                      : new Date().toISOString(),
                    tags: []
                  }))
                : documentGroups.map(doc => ({
                    id: doc.documentId,
                    title: doc.filename || 'Memory Item',
                    source: doc.source,
                    aiPlatform: (doc as any).aiPlatform, // Pass AI platform for correct coloring
                    timestamp: new Date(doc.createdAt).toISOString(),
                    tags: []
                  }))
              }
              onSelectMemory={(id) => {
                const result = searchResults.find(r => r.id === id);
                if (result) {
                  console.log('Selected memory:', result);
                }
              }}
            />
            {searchResults.length === 0 && documentGroups.length === 0 && memory.isReady && (
              <Card className="mt-4">
                <CardContent className="py-8 text-center">
                  <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {t('memory.graph.empty', 'No hay memorias para visualizar. Añade contenido primero.')}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="voice">
            <VoiceNotesPanel
              onNoteAdded={() => {
                memory.getStats().then(setStats);
                loadDocumentGroups();
              }}
            />
          </TabsContent>
          
          <TabsContent value="audio">
            <AudioBriefingsList />
          </TabsContent>
          
          <TabsContent value="connectors">
            <ConnectorSettings />
          </TabsContent>
          
          <TabsContent value="sync">
            <MemorySyncSettings onSyncComplete={() => memory.getStats().then(setStats)} />
          </TabsContent>
        </Tabs>
        
        {/* Add Note Dialog */}
        <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('memory.notes.addNote', 'Añadir nota a Memoria')}</DialogTitle>
              <DialogDescription>
                {t('memory.notes.addNoteDesc', 'Esta nota será cifrada y buscable en tus conversaciones de IA.')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder={t('memory.notes.titlePlaceholder', 'Título de la nota (opcional)')}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
              <Textarea
                placeholder={t('memory.notes.contentPlaceholder', 'Escribe tu nota...')}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={6}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleAddNote} 
                disabled={!noteContent.trim() || isAddingNote}
              >
                {isAddingNote && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t('memory.notes.addToMemory', 'Añadir a Memoria')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Clear Confirmation */}
        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('memory.clearAll.title', '¿Limpiar toda la memoria?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('memory.clearAll.description', 'Esto eliminará permanentemente todos los elementos de tu memoria IA. Esta acción no se puede deshacer.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t('memory.clearAll.confirm', 'Limpiar Todo')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Bulk Upload Dialog */}
        <BulkUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          folders={folders}
          onUpload={handleBulkUpload}
          onUploadComplete={() => {
            loadDocumentGroups();
            loadFolders();
          }}
        />
        
        {/* Vault Unlock Dialog */}
        <VaultUnlockDialog
          open={showUnlock}
          onOpenChange={setShowUnlock}
          onUnlocked={() => setShowUnlock(false)}
        />
        
        {/* Memory Restore Dialog */}
        <MemoryRestoreDialog
          open={shouldShowRestore}
          onOpenChange={(open) => {
            if (!open) dismissRestore();
          }}
          onComplete={() => {
            memory.getStats().then(setStats);
          }}
        />
        
        {/* Onboarding Dialog */}
        {hasChecked && (
          <MemoryOnboarding
            open={showOnboarding}
            onComplete={completeOnboarding}
            onSkip={skipOnboarding}
          />
        )}
        
        {/* Import AI History Modal */}
        <ImportAIHistoryModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onComplete={() => {
            memory.getStats().then(setStats);
            loadDocumentGroups();
            toast({ title: 'Import complete!', description: 'Your AI history has been imported.' });
          }}
        />
        
        {/* Memory Migration Dialog */}
        <MemoryMigrationDialog
          open={showMigration}
          onOpenChange={setShowMigration}
          onComplete={() => {
            memory.getStats().then(setStats);
            loadDocumentGroups();
          }}
        />
      </div>
    </div>
  );
}

// Wrap with error boundary
export default function MemoryDashboard() {
  return (
    <MemoryErrorBoundary>
      <MemoryDashboardContent />
    </MemoryErrorBoundary>
  );
}
