import { LibraryItem } from '@/pages/GhostLibrary';
import { LibraryItemCard } from './LibraryItemCard';
import { LibraryEmptyState } from './LibraryEmptyState';
import { Skeleton } from '@/components/ui/skeleton';

interface LibraryGridProps {
  items: LibraryItem[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  selectedItems: Set<string>;
  onSelectItem: (id: string) => void;
  onOpenItem: (item: LibraryItem) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteItem: (id: string) => void;
  activeTab: 'all' | 'images' | 'videos';
}

export function LibraryGrid({
  items,
  isLoading,
  viewMode,
  selectedItems,
  onSelectItem,
  onOpenItem,
  onToggleFavorite,
  onDeleteItem,
  activeTab,
}: LibraryGridProps) {
  if (isLoading) {
    return (
      <div className={viewMode === 'grid' 
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" 
        : "flex flex-col gap-2"
      }>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={viewMode === 'grid' ? "aspect-square rounded-lg" : "h-16 rounded-lg"} 
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <LibraryEmptyState activeTab={activeTab} />;
  }

  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            viewMode="list"
            isSelected={selectedItems.has(item.id)}
            onSelect={() => onSelectItem(item.id)}
            onOpen={() => onOpenItem(item)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <LibraryItemCard
          key={item.id}
          item={item}
          viewMode="grid"
          isSelected={selectedItems.has(item.id)}
          onSelect={() => onSelectItem(item.id)}
          onOpen={() => onOpenItem(item)}
          onToggleFavorite={() => onToggleFavorite(item.id)}
          onDelete={() => onDeleteItem(item.id)}
        />
      ))}
    </div>
  );
}
