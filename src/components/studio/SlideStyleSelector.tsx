import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlideStyleName } from '@/types/slides';
import { SLIDE_STYLES } from '@/lib/slide-styles';

interface SlideStyleSelectorProps {
  selected: SlideStyleName;
  onChange: (style: SlideStyleName) => void;
  disabled?: boolean;
}

export function SlideStyleSelector({ selected, onChange, disabled }: SlideStyleSelectorProps) {
  const [hoveredStyle, setHoveredStyle] = useState<SlideStyleName | null>(null);
  
  const styles = Object.entries(SLIDE_STYLES) as [SlideStyleName, typeof SLIDE_STYLES[SlideStyleName]][];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Sparkles className="w-4 h-4 text-[#1D4E5F]" />
        Presentation Style
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {styles.map(([styleName, config]) => (
          <button
            key={styleName}
            onClick={() => !disabled && onChange(styleName)}
            onMouseEnter={() => setHoveredStyle(styleName)}
            onMouseLeave={() => setHoveredStyle(null)}
            disabled={disabled}
            className={cn(
              'relative group rounded-xl p-3 transition-all duration-200',
              'border-2 hover:shadow-lg',
              selected === styleName
                ? 'border-[#1D4E5F] bg-[#1D4E5F]/5 shadow-md'
                : 'border-gray-200 hover:border-[#1D4E5F]/50 bg-white',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Style Preview */}
            <div 
              className="aspect-video rounded-lg overflow-hidden mb-2 relative"
              style={{ backgroundColor: config.colors.background }}
            >
              {/* Mini slide preview */}
              <div className="absolute inset-1 flex flex-col gap-1 p-1">
                <div 
                  className="h-1.5 w-3/4 rounded-sm"
                  style={{ backgroundColor: config.colors.primary }}
                />
                <div 
                  className="h-1 w-1/2 rounded-sm opacity-60"
                  style={{ backgroundColor: config.colors.muted }}
                />
                <div className="flex-1 flex gap-1 mt-1">
                  <div 
                    className="flex-1 rounded-sm"
                    style={{ backgroundColor: config.colors.secondary, opacity: 0.3 }}
                  />
                  <div 
                    className="w-1/3 rounded-sm"
                    style={{ backgroundColor: config.colors.accent, opacity: 0.5 }}
                  />
                </div>
                <div 
                  className="h-0.5 w-full mt-auto"
                  style={{ backgroundColor: config.colors.primary }}
                />
              </div>
            </div>
            
            {/* Style Name */}
            <p className={cn(
              'text-xs font-medium text-center truncate',
              selected === styleName ? 'text-[#1D4E5F]' : 'text-gray-600'
            )}>
              {config.displayName}
            </p>
            
            {/* Selected Checkmark */}
            {selected === styleName && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#1D4E5F] rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      
      {/* Hovered Style Description */}
      {hoveredStyle && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex-shrink-0"
              style={{ 
                background: `linear-gradient(135deg, ${SLIDE_STYLES[hoveredStyle].colors.primary}, ${SLIDE_STYLES[hoveredStyle].colors.secondary})` 
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {SLIDE_STYLES[hoveredStyle].displayName}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {SLIDE_STYLES[hoveredStyle].description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Best for: {SLIDE_STYLES[hoveredStyle].bestFor}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
