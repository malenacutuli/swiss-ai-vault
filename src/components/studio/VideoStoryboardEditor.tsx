import React, { useState } from 'react';
import { Play, Clock, ChevronUp, ChevronDown, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Scene {
  index: number;
  duration_seconds: number;
  script: string;
  visual_prompt: string;
  audio_cue: string;
  key_point: string;
  image_url?: string;
}

interface VideoStoryboardEditorProps {
  scenes: Scene[];
  onScenesChange: (scenes: Scene[]) => void;
  totalDuration: number;
  narratorVoice: string;
  onNarratorChange: (voice: string) => void;
  onGenerate: () => void;
  loading: boolean;
}

const NARRATOR_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', description: 'Warm and engaging' },
  { id: 'fable', name: 'Fable', description: 'Expressive storyteller' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and professional' },
];

export function VideoStoryboardEditor({
  scenes,
  onScenesChange,
  totalDuration,
  narratorVoice,
  onNarratorChange,
  onGenerate,
  loading
}: VideoStoryboardEditorProps) {
  const [expandedScene, setExpandedScene] = useState<number | null>(0);

  const handleSceneEdit = (index: number, field: keyof Scene, value: string | number) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    onScenesChange(newScenes);
  };

  const moveScene = (index: number, direction: 'up' | 'down') => {
    const newScenes = [...scenes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;
    
    [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]];
    newScenes.forEach((s, i) => s.index = i);
    onScenesChange(newScenes);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Video Storyboard</h3>
          <p className="text-sm text-muted-foreground">
            {scenes.length} scenes • {totalDuration}s total
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={narratorVoice} onValueChange={onNarratorChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Narrator voice" />
            </SelectTrigger>
            <SelectContent>
              {NARRATOR_VOICES.map(voice => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div>
                    <p className="font-medium">{voice.name}</p>
                    <p className="text-xs text-muted-foreground">{voice.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={onGenerate} disabled={loading} className="bg-primary">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rendering...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Generate Video
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {scenes.map((scene, index) => (
          <div key={index} className="bg-background">
            {/* Scene header */}
            <div 
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedScene(expandedScene === index ? null : index)}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{scene.key_point}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {scene.duration_seconds}s
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); moveScene(index, 'up'); }}
                  disabled={index === 0}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); moveScene(index, 'down'); }}
                  disabled={index === scenes.length - 1}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Expanded content */}
            {expandedScene === index && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/10">
                {/* Visual preview */}
                {scene.image_url ? (
                  <img 
                    src={scene.image_url} 
                    alt={`Scene ${index + 1}`} 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Preview will generate with video</p>
                  </div>
                )}

                {/* Script */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Narration Script</label>
                  <textarea
                    value={scene.script}
                    onChange={(e) => handleSceneEdit(index, 'script', e.target.value)}
                    className="w-full mt-1 p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    rows={4}
                  />
                </div>

                {/* Visual prompt */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Visual Prompt</label>
                  <textarea
                    value={scene.visual_prompt}
                    onChange={(e) => handleSceneEdit(index, 'visual_prompt', e.target.value)}
                    className="w-full mt-1 p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    rows={2}
                    placeholder="Describe the visual for this scene..."
                  />
                </div>

                {/* Duration slider */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Duration: {scene.duration_seconds}s
                  </label>
                  <Slider
                    value={[scene.duration_seconds]}
                    onValueChange={([value]) => handleSceneEdit(index, 'duration_seconds', value)}
                    min={5}
                    max={30}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer with total time */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Duration</span>
          <span className="font-mono font-bold text-primary">
            {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
