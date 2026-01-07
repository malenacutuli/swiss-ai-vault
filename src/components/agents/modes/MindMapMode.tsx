import { useState } from 'react';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceUpload, type Source } from '../SourceUpload';

interface MindMapModeProps {
  onPromptSelect: (text: string) => void;
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
  maxDepth: number;
  onMaxDepthChange: (depth: number) => void;
  focusArea: string;
  onFocusAreaChange: (area: string) => void;
}

const DEPTH_OPTIONS = [
  { value: 2, label: '2 levels', description: 'Simple overview' },
  { value: 3, label: '3 levels', description: 'Balanced detail' },
  { value: 4, label: '4 levels', description: 'Comprehensive' },
];

export function MindMapMode({ 
  onPromptSelect,
  sources,
  onSourcesChange,
  maxDepth,
  onMaxDepthChange,
  focusArea,
  onFocusAreaChange
}: MindMapModeProps) {
  const handleGenerate = () => {
    let prompt = `Generate a mind map with ${maxDepth} levels of depth from the uploaded sources`;
    if (focusArea.trim()) {
      prompt += `. Focus on: ${focusArea}`;
    }
    onPromptSelect(prompt);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Source upload */}
      <SourceUpload 
        sources={sources}
        onSourcesChange={onSourcesChange}
        title="Add content for mind map"
        description="Upload documents or paste URLs to visualize as a mind map."
      />
      
      {/* Mind Map Settings */}
      <section className="bg-white rounded-xl border border-[#E5E5E5] p-6 space-y-6">
        <h3 className="font-medium text-[#1A1A1A]">Mind Map Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-[#666666] font-medium">Maximum depth</label>
            <select 
              value={maxDepth}
              onChange={(e) => onMaxDepthChange(Number(e.target.value))}
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {DEPTH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs text-[#666666] font-medium">Focus area (optional)</label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => onFocusAreaChange(e.target.value)}
              placeholder="e.g., 'Key concepts' or 'Timeline'"
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            />
          </div>
        </div>
      </section>
      
      {/* Generate button */}
      <Button 
        className="w-full bg-[#722F37] hover:bg-[#5a252c] text-white py-6 text-base"
        onClick={handleGenerate}
        disabled={sources.length === 0}
      >
        <Network className="w-5 h-5 mr-2" />
        Generate Mind Map
      </Button>
      
      {sources.length === 0 && (
        <p className="text-center text-sm text-[#999999]">
          Add at least one source to generate a mind map
        </p>
      )}
    </div>
  );
}
