import { useState } from 'react';
import { LibraryItem } from '@/pages/GhostLibrary';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  Trash2, 
  Download, 
  Play,
  Image as ImageIcon,
  Video
} from '@/icons';
import { formatDistanceToNow } from 'date-fns';

interface LibraryItemCardProps {
  item: LibraryItem;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export function LibraryItemCard({
  item,
  viewMode,
  isSelected,
  onSelect,
  onOpen,
  onToggleFavorite,
  onDelete,
}: LibraryItemCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // For blob URLs, we can download directly
    if (item.storage_key.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = item.storage_key;
      a.download = item.title || `ghost-${item.content_type}-${item.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (viewMode === 'list') {
    return (
      <div 
        className={`
          flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer
          ${isSelected ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border hover:bg-muted/30'}
        `}
        onClick={onOpen}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect()}
          onClick={(e) => e.stopPropagation()}
          className="data-[state=checked]:bg-primary"
        />

        {/* Thumbnail */}
        <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {item.content_type === 'image' ? (
            <img 
              src={item.storage_key} 
              alt={item.title || 'Generated image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Video className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          {item.content_type === 'video' && item.duration_seconds && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white">
              {formatDuration(item.duration_seconds)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {item.title || 'Untitled'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {item.prompt?.slice(0, 60) || 'No prompt'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {item.model_id && (
              <Badge variant="outline" className="text-[10px] h-5">
                {item.model_id}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          >
            <Star className={`h-4 w-4 ${item.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div 
      className={`
        group relative aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer
        ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/40 hover:border-border'}
      `}
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content */}
      {item.content_type === 'image' ? (
        <img 
          src={item.storage_key} 
          alt={item.title || 'Generated image'}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Video className="h-12 w-12 text-muted-foreground" />
        </div>
      )}

      {/* Favorite badge */}
      {item.is_favorite && (
        <div className="absolute top-2 right-2 z-10">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow" />
        </div>
      )}

      {/* Video duration */}
      {item.content_type === 'video' && item.duration_seconds && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white">
          {formatDuration(item.duration_seconds)}
        </div>
      )}

      {/* Hover overlay */}
      <div className={`
        absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
        transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}
      `}>
        {/* Checkbox */}
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect()}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=checked]:bg-primary border-white/50"
          />
        </div>

        {/* Play button for videos */}
        {item.content_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Info & Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-sm font-medium truncate mb-1">
            {item.title || 'Untitled'}
          </p>
          <p className="text-white/70 text-xs truncate mb-2">
            {item.prompt?.slice(0, 40) || 'No prompt'}
          </p>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            >
              <Star className={`h-3.5 w-3.5 ${item.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-white/10 hover:bg-white/20 text-white"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
