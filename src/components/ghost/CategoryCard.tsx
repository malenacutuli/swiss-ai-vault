import { cn } from '@/lib/utils';

interface CategoryCardProps {
  name: string;
  gradientFrom: string;
  gradientTo: string;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({ 
  name, 
  gradientFrom, 
  gradientTo,
  onClick,
  className
}: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative aspect-[4/3] rounded-xl overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        className
      )}
    >
      {/* Gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
        }}
      />
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
        }}
      />
      
      {/* Bottom gradient for text */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/40 to-transparent" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <p className="text-white text-sm font-medium leading-tight">{name}</p>
      </div>
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
    </button>
  );
}

// Professional color palette for categories
export const PATENT_CATEGORIES = [
  { name: 'Computers & Software', gradientFrom: '#1e3a5f', gradientTo: '#2d5a87' },
  { name: 'Medical & Healthcare', gradientFrom: '#1a4d4d', gradientTo: '#2a7a7a' },
  { name: 'Industrial Manufacturing', gradientFrom: '#3d3d5c', gradientTo: '#5a5a7a' },
];

export const LEGAL_CATEGORIES = [
  { name: 'Financial Regulations', gradientFrom: '#1e3a5f', gradientTo: '#2d5a87' },
  { name: 'Data Protection', gradientFrom: '#1a4d5a', gradientTo: '#2a7a8a' },
  { name: 'Corporate & Securities', gradientFrom: '#3d3d5c', gradientTo: '#5a5a7a' },
  { name: 'Cross-Border Compliance', gradientFrom: '#5a4a3d', gradientTo: '#7a6a5a' },
];

export const RESEARCH_CATEGORIES = [
  { name: 'Life Sciences', gradientFrom: '#1a4d4d', gradientTo: '#2a7a7a' },
  { name: 'Technology', gradientFrom: '#1e3a5f', gradientTo: '#2d5a87' },
  { name: 'Economics', gradientFrom: '#5a4a3d', gradientTo: '#7a6a5a' },
  { name: 'Environmental', gradientFrom: '#2d4a3d', gradientTo: '#4a7a5a' },
];
