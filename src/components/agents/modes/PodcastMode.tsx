import { useState } from 'react';
import { Radio, ArrowUpRight, Mic } from 'lucide-react';
import { SourceUpload, type Source } from '../SourceUpload';
import { cn } from '@/lib/utils';

const PODCAST_PROMPTS = [
  "Create a podcast explaining the key concepts from my documents",
  "Generate a 15-minute discussion about the uploaded research",
  "Summarize yesterday's AI news into an energetic audio show",
  "Create a calming meditation audio session",
  "Produce a lively voiceover for a product script"
];

const VOICE_OPTIONS = [
  { id: 'kore', name: 'Kore', gender: 'female', style: 'Professional' },
  { id: 'charon', name: 'Charon', gender: 'male', style: 'Warm' },
  { id: 'puck', name: 'Puck', gender: 'male', style: 'Energetic' },
  { id: 'aoede', name: 'Aoede', gender: 'female', style: 'Calm' },
  { id: 'fenrir', name: 'Fenrir', gender: 'male', style: 'Deep' },
  { id: 'leda', name: 'Leda', gender: 'female', style: 'Warm' },
];

interface PodcastModeProps {
  onPromptSelect: (text: string) => void;
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
  hostA: string;
  hostB: string;
  onHostAChange: (host: string) => void;
  onHostBChange: (host: string) => void;
}

export function PodcastMode({ 
  onPromptSelect, 
  sources,
  onSourcesChange,
  hostA,
  hostB,
  onHostAChange,
  onHostBChange
}: PodcastModeProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Sources Section */}
      <SourceUpload
        sources={sources}
        onSourcesChange={onSourcesChange}
        title="Add sources for your podcast"
        description="Upload documents, paste URLs, or add YouTube links. The AI will discuss these in a conversational podcast format."
      />
      
      {/* Voice Selection */}
      <section className="bg-white rounded-xl border border-[#E5E5E5] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="w-5 h-5 text-[#722F37]" />
          <h3 className="font-medium text-[#1A1A1A]">Choose hosts</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#666666] font-medium">Host A (Interviewer)</label>
            <select
              value={hostA}
              onChange={(e) => onHostAChange(e.target.value)}
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {VOICE_OPTIONS.map(v => (
                <option key={v.id} value={v.id}>{v.name} - {v.style}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#666666] font-medium">Host B (Expert)</label>
            <select
              value={hostB}
              onChange={(e) => onHostBChange(e.target.value)}
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {VOICE_OPTIONS.map(v => (
                <option key={v.id} value={v.id}>{v.name} - {v.style}</option>
              ))}
            </select>
          </div>
        </div>
      </section>
      
      {/* Sample Prompts */}
      <section>
        <h3 className="text-sm font-medium text-[#666666] mb-4">Or try these</h3>
        <div className="space-y-2">
          {PODCAST_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onPromptSelect(prompt)}
              className="w-full text-left p-3 text-sm text-[#4A4A4A] hover:bg-[#FAFAF8] rounded-lg flex items-center justify-between group border border-transparent hover:border-[#E5E5E5] transition-all"
            >
              <span className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-[#999999] group-hover:text-[#722F37]" />
                {prompt}
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#CCCCCC] group-hover:text-[#722F37] transition-colors" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
