import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SourceUpload, type Source } from '../SourceUpload';

interface FlashcardsModeProps {
  onPromptSelect: (text: string) => void;
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
  cardCount: number;
  onCardCountChange: (count: number) => void;
  difficulty: string;
  onDifficultyChange: (difficulty: string) => void;
}

const CARD_COUNTS = [10, 20, 30, 50];
const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', description: 'Basic concepts and definitions' },
  { id: 'medium', label: 'Medium', description: 'Understanding and application' },
  { id: 'hard', label: 'Hard', description: 'Analysis and synthesis' },
];

export function FlashcardsMode({ 
  onPromptSelect,
  sources,
  onSourcesChange,
  cardCount,
  onCardCountChange,
  difficulty,
  onDifficultyChange
}: FlashcardsModeProps) {
  const handleGenerate = () => {
    const diffLabel = DIFFICULTIES.find(d => d.id === difficulty)?.label || 'Medium';
    onPromptSelect(`Generate ${cardCount} ${diffLabel.toLowerCase()} flashcards from the uploaded sources`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Source upload */}
      <SourceUpload 
        sources={sources}
        onSourcesChange={onSourcesChange}
        title="Add study materials"
        description="Upload documents or paste URLs to generate flashcards from."
      />
      
      {/* Settings */}
      <section className="bg-white rounded-xl border border-[#E5E5E5] p-6">
        <h3 className="font-medium text-[#1A1A1A] mb-4">Flashcard settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-[#666666] font-medium">Number of cards</label>
            <select
              value={cardCount}
              onChange={(e) => onCardCountChange(Number(e.target.value))}
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {CARD_COUNTS.map(n => (
                <option key={n} value={n}>{n} cards</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs text-[#666666] font-medium">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value)}
              className="w-full mt-1.5 border border-[#E5E5E5] rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {DIFFICULTIES.map(d => (
                <option key={d.id} value={d.id}>{d.label} - {d.description}</option>
              ))}
            </select>
          </div>
        </div>
      </section>
      
      {/* Generate button */}
      <Button 
        className="w-full bg-[#722F37] hover:bg-[#5a252c] text-white py-6 text-base"
        onClick={handleGenerate}
        disabled={sources.length === 0}
      >
        <Layers className="w-5 h-5 mr-2" />
        Generate {cardCount} Flashcards
      </Button>
      
      {sources.length === 0 && (
        <p className="text-center text-sm text-[#999999]">
          Add at least one source to generate flashcards
        </p>
      )}
    </div>
  );
}
