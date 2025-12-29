import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Search, 
  Grid3X3, 
  List, 
  Image as ImageIcon, 
  Video,
  Plus,
  FolderPlus,
  Star,
  Trash2,
  Download,
  HardDrive
} from '@/icons';
import { LibraryGrid } from '@/components/ghost/library/LibraryGrid';
import { LibraryLightbox } from '@/components/ghost/library/LibraryLightbox';
import { FolderSidebar } from '@/components/ghost/library/FolderSidebar';
import { toast } from 'sonner';

export interface LibraryItem {
  id: string;
  content_type: 'image' | 'video';
  storage_type: string;
  storage_key: string;
  prompt: string | null;
  model_id: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  is_favorite: boolean;
  folder_id: string | null;
  tags: string[] | null;
  thumbnail_key: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  item_count: number;
}

type TabValue = 'all' | 'images' | 'videos';
type SortValue = 'newest' | 'oldest' | 'name';
type ViewMode = 'grid' | 'list';

export default function GhostLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showFolderSidebar, setShowFolderSidebar] = useState(false);

  // Fetch library items
  useEffect(() => {
    if (!user) return;
    
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('ghost_library')
          .select('*')
          .eq('user_id', user.id);

        // Filter by content type
        if (activeTab === 'images') {
          query = query.eq('content_type', 'image');
        } else if (activeTab === 'videos') {
          query = query.eq('content_type', 'video');
        }

        // Filter by folder
        if (selectedFolder) {
          query = query.eq('folder_id', selectedFolder);
        }

        // Filter favorites
        if (showFavoritesOnly) {
          query = query.eq('is_favorite', true);
        }

        // Sort
        if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else {
          query = query.order('title', { ascending: true });
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // Filter by search query client-side
        let filtered = (data || []) as LibraryItem[];
        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          filtered = filtered.filter(item => 
            item.title?.toLowerCase().includes(lowerQuery) ||
            item.prompt?.toLowerCase().includes(lowerQuery) ||
            item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
          );
        }

        setItems(filtered);
      } catch (error) {
        console.error('Failed to fetch library items:', error);
        toast.error('Failed to load library');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [user, activeTab, selectedFolder, showFavoritesOnly, sortBy, searchQuery]);

  const handleToggleFavorite = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      const { error } = await supabase
        .from('ghost_library')
        .update({ is_favorite: !item.is_favorite })
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, is_favorite: !i.is_favorite } : i
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('ghost_library')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item deleted');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      const { error } = await supabase
        .from('ghost_library')
        .delete()
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setItems(prev => prev.filter(i => !selectedItems.has(i.id)));
      setSelectedItems(new Set());
      toast.success(`Deleted ${selectedItems.size} items`);
    } catch (error) {
      console.error('Failed to delete items:', error);
      toast.error('Failed to delete items');
    }
  };

  const totalStorageBytes = items.reduce((acc, item) => acc + (item.file_size_bytes || 0), 0);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const imageCount = items.filter(i => i.content_type === 'image').length;
  const videoCount = items.filter(i => i.content_type === 'video').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/ghost')}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-medium tracking-tight">Library</h1>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {items.length} items
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{formatBytes(totalStorageBytes)}</span>
            </div>
            {selectedItems.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete ({selectedItems.size})
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Folder Sidebar */}
        {showFolderSidebar && (
          <FolderSidebar
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            onClose={() => setShowFolderSidebar(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="text-xs">
                  All ({items.length})
                </TabsTrigger>
                <TabsTrigger value="images" className="text-xs">
                  <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                  Images ({imageCount})
                </TabsTrigger>
                <TabsTrigger value="videos" className="text-xs">
                  <Video className="h-3.5 w-3.5 mr-1.5" />
                  Videos ({videoCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/50 border-border/40"
              />
            </div>

            {/* Favorites filter */}
            <Button
              variant={showFavoritesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="h-9"
            >
              <Star className={`h-3.5 w-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </Button>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortValue)}>
              <SelectTrigger className="w-32 h-9 text-sm bg-muted/50 border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex border border-border/40 rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-9 rounded-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-9 rounded-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Folder toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFolderSidebar(!showFolderSidebar)}
              className="h-9"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <LibraryGrid
            items={items}
            isLoading={isLoading}
            viewMode={viewMode}
            selectedItems={selectedItems}
            onSelectItem={(id) => {
              setSelectedItems(prev => {
                const next = new Set(prev);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              });
            }}
            onOpenItem={setSelectedItem}
            onToggleFavorite={handleToggleFavorite}
            onDeleteItem={handleDeleteItem}
            activeTab={activeTab}
          />
        </main>
      </div>

      {/* Lightbox */}
      {selectedItem && (
        <LibraryLightbox
          item={selectedItem}
          items={items}
          onClose={() => setSelectedItem(null)}
          onNavigate={(item) => setSelectedItem(item)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeleteItem}
        />
      )}
    </div>
  );
}
