import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { SourceUpload, type Source } from '../SourceUpload';
import { cn } from '@/lib/utils';

interface QuizModeProps {
  onPromptSelect: (text: string) => void;
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  questionTypes: string[];
  onQuestionTypesChange: (types: string[]) => void;
}

const QUESTION_TYPE_OPTIONS = [
  { id: 'multiple_choice', label: 'Multiple Choice', icon: '○' },
  { id: 'true_false', label: 'True/False', icon: '◐' },
  { id: 'short_answer', label: 'Short Answer', icon: '▭' },
];

export function QuizMode({ 
  onPromptSelect,
  sources,
  onSourcesChange,
  questionCount,
  onQuestionCountChange,
  questionTypes,
  onQuestionTypesChange
}: QuizModeProps) {
  const toggleQuestionType = (typeId: string) => {
    if (questionTypes.includes(typeId)) {
      // Don't allow removing the last type
      if (questionTypes.length > 1) {
        onQuestionTypesChange(questionTypes.filter(t => t !== typeId));
      }
    } else {
      onQuestionTypesChange([...questionTypes, typeId]);
    }
  };

  const handleGenerate = () => {
    const typesLabel = questionTypes.map(t => 
      QUESTION_TYPE_OPTIONS.find(o => o.id === t)?.label
    ).filter(Boolean).join(', ');
    
    onPromptSelect(`Generate a quiz with ${questionCount} questions (${typesLabel}) from the uploaded sources`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Source upload */}
      <SourceUpload 
        sources={sources}
        onSourcesChange={onSourcesChange}
        title="Add quiz materials"
        description="Upload documents or paste URLs to generate quiz questions from."
      />
      
      {/* Quiz settings */}
      <section className="bg-white rounded-xl border border-[#E5E5E5] p-6 space-y-6">
        <h3 className="font-medium text-[#1A1A1A]">Quiz settings</h3>
        
        {/* Question count slider */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-[#666666]">Number of questions</label>
            <span className="text-sm font-medium text-[#722F37]">{questionCount}</span>
          </div>
          <Slider
            value={[questionCount]}
            onValueChange={([v]) => onQuestionCountChange(v)}
            min={5}
            max={30}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[#999999] mt-1">
            <span>5</span>
            <span>30</span>
          </div>
        </div>
        
        {/* Question types */}
        <div>
          <label className="text-sm text-[#666666] mb-3 block">Question types</label>
          <div className="flex flex-wrap gap-3">
            {QUESTION_TYPE_OPTIONS.map(type => (
              <button
                key={type.id}
                onClick={() => toggleQuestionType(type.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm",
                  questionTypes.includes(type.id)
                    ? "bg-[#722F37]/10 border-[#722F37] text-[#722F37]"
                    : "bg-white border-[#E5E5E5] text-[#666666] hover:border-[#722F37]/30"
                )}
              >
                <span className="text-base">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      
      {/* Generate button */}
      <Button 
        className="w-full bg-[#722F37] hover:bg-[#5a252c] text-white py-6 text-base"
        onClick={handleGenerate}
        disabled={sources.length === 0}
      >
        <HelpCircle className="w-5 h-5 mr-2" />
        Generate Quiz
      </Button>
      
      {sources.length === 0 && (
        <p className="text-center text-sm text-[#999999]">
          Add at least one source to generate a quiz
        </p>
      )}
    </div>
  );
}
