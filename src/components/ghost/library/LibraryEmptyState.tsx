import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Video, Sparkles } from '@/icons';

interface LibraryEmptyStateProps {
  activeTab: 'all' | 'images' | 'videos';
}

export function LibraryEmptyState({ activeTab }: LibraryEmptyStateProps) {
  const navigate = useNavigate();

  const config = {
    all: {
      icon: Sparkles,
      title: 'Your library is empty',
      description: 'Generated images and videos will appear here',
      cta: 'Start Creating',
    },
    images: {
      icon: ImageIcon,
      title: 'No images yet',
      description: 'Your generated images will appear here',
      cta: 'Generate Image',
    },
    videos: {
      icon: Video,
      title: 'No videos yet',
      description: 'Your generated videos will appear here',
      cta: 'Generate Video',
    },
  };

  const { icon: Icon, title, description, cta } = config[activeTab];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-muted-foreground/50" />
      </div>
      
      <h3 className="text-lg font-medium text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        {description}
      </p>
      
      <Button 
        onClick={() => navigate('/ghost')}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {cta}
      </Button>
    </div>
  );
}
