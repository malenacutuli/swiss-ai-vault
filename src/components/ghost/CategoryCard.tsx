import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
  nameKey: string;
  gradientFrom: string;
  gradientTo: string;
  image?: string;
  tagline?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CategoryCard({
  nameKey,
  gradientFrom,
  gradientTo,
  image,
  tagline,
  onClick,
  size = 'md',
  className
}: CategoryCardProps) {
  const { t } = useTranslation();
  
  const sizeClasses = {
    sm: 'h-24',
    md: 'h-32',
    lg: 'h-40',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg w-full",
        sizeClasses[size],
        className
      )}
    >
      {/* Background: Image or Gradient */}
      {image ? (
        <>
          <img
            src={image}
            alt={t(nameKey)}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Gradient overlay for text readability */}
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
          />
        </>
      ) : (
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
          }}
        />
      )}
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <p className="text-white text-sm font-semibold leading-tight drop-shadow-sm">
          {t(nameKey)}
        </p>
        {tagline && (
          <p className="text-white/80 text-xs mt-1 leading-tight drop-shadow-sm">
            {tagline}
          </p>
        )}
      </div>
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
    </button>
  );
}

// Updated category arrays with high-quality images
export const LEGAL_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.financialRegulations', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.dataProtection', 
    gradientFrom: '#1a4d5a', 
    gradientTo: '#2a7a8a',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.corporateSecurities', 
    gradientFrom: '#3d3d5c', 
    gradientTo: '#5a5a7a',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.crossBorderCompliance', 
    gradientFrom: '#5a4a3d', 
    gradientTo: '#7a6a5a',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop'
  },
];

export const PATENT_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.computersSoftware', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.medicalHealthcare', 
    gradientFrom: '#1a4d4d', 
    gradientTo: '#2a7a7a',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.industrialManufacturing', 
    gradientFrom: '#3d3d5c', 
    gradientTo: '#5a5a7a',
    image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&h=300&fit=crop'
  },
];

export const RESEARCH_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.lifeSciences', 
    gradientFrom: '#1a4d4d', 
    gradientTo: '#2a7a7a',
    image: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.computerScience', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.physicsMathematics', 
    gradientFrom: '#3d3d5c', 
    gradientTo: '#5a5a7a',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.socialSciences', 
    gradientFrom: '#5a4a3d', 
    gradientTo: '#7a6a5a',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop'
  },
];

export const FINANCE_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.stocks', 
    gradientFrom: '#166534', 
    gradientTo: '#22c55e',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.crypto', 
    gradientFrom: '#f59e0b', 
    gradientTo: '#fbbf24',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.commodities', 
    gradientFrom: '#78350f', 
    gradientTo: '#b45309',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=300&fit=crop'
  },
  { 
    nameKey: 'ghost.categories.forex', 
    gradientFrom: '#0e7490', 
    gradientTo: '#22d3ee',
    image: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=400&h=300&fit=crop'
  },
];
