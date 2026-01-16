import React from 'react';
import { LayoutGrid, Columns, Clock, BarChart2, GitBranch, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface InfographicOptionsProps {
  layoutType: string;
  onLayoutChange: (layout: string) => void;
  orientation: string;
  onOrientationChange: (orientation: string) => void;
  detailLevel: string;
  onDetailLevelChange: (level: string) => void;
  onGenerate: () => void;
  loading: boolean;
}

const LAYOUTS = [
  { id: 'comparison', label: 'Comparison', icon: Columns, description: 'Side-by-side analysis' },
  { id: 'timeline', label: 'Timeline', icon: Clock, description: 'Chronological events' },
  { id: 'statistics', label: 'Statistics', icon: BarChart2, description: 'Key numbers & metrics' },
  { id: 'process', label: 'Process', icon: GitBranch, description: 'Step-by-step flow' },
  { id: 'hierarchy', label: 'Hierarchy', icon: LayoutGrid, description: 'Organizational structure' },
];

const ORIENTATIONS = [
  { id: 'portrait', label: 'Portrait', dimensions: '1080 × 1920', ratio: 'h-20 w-12' },
  { id: 'landscape', label: 'Landscape', dimensions: '1920 × 1080', ratio: 'h-12 w-20' },
  { id: 'square', label: 'Square', dimensions: '1080 × 1080', ratio: 'h-16 w-16' },
];

export function InfographicOptions({
  layoutType,
  onLayoutChange,
  orientation,
  onOrientationChange,
  detailLevel,
  onDetailLevelChange,
  onGenerate,
  loading
}: InfographicOptionsProps) {
  return (
    <div className="space-y-6 p-6 bg-card border border-border rounded-xl">
      {/* Layout Type */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Layout Type</h4>
        <div className="grid gap-2">
          {LAYOUTS.map(layout => (
            <button
              key={layout.id}
              onClick={() => onLayoutChange(layout.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                layoutType === layout.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <layout.icon className={`w-5 h-5 ${layoutType === layout.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${layoutType === layout.id ? 'text-primary' : 'text-foreground'}`}>
                  {layout.label}
                </p>
                <p className="text-xs text-muted-foreground">{layout.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Orientation */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Orientation</h4>
        <div className="grid grid-cols-3 gap-3">
          {ORIENTATIONS.map(orient => (
            <button
              key={orient.id}
              onClick={() => onOrientationChange(orient.id)}
              className={`flex-1 p-4 rounded-lg border transition-all ${
                orientation === orient.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className={`${orient.ratio} bg-muted rounded mx-auto mb-2`} />
              <p className={`text-xs font-medium ${orientation === orient.id ? 'text-primary' : 'text-foreground'}`}>
                {orient.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{orient.dimensions}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Detail Level */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Detail Level</h4>
        <RadioGroup value={detailLevel} onValueChange={onDetailLevelChange} className="flex gap-4">
          {['concise', 'standard', 'detailed'].map(level => (
            <div key={level} className="flex items-center space-x-2">
              <RadioGroupItem value={level} id={level} />
              <Label htmlFor={level} className="capitalize cursor-pointer">{level}</Label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {detailLevel === 'concise' && '3 key data points • Quick overview'}
          {detailLevel === 'standard' && '5 data points • Balanced detail'}
          {detailLevel === 'detailed' && '7+ data points • Comprehensive'}
        </p>
      </div>

      {/* Generate button */}
      <Button onClick={onGenerate} disabled={loading} className="w-full bg-primary">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            Generate Infographic
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
