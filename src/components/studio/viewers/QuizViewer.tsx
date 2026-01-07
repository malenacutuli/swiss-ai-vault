import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface QuizViewerProps {
  questions: QuizQuestion[];
  title?: string;
}

export function QuizViewer({ questions, title }: QuizViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedOption === currentQuestion?.correctIndex;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
    if (selectedOption === currentQuestion.correctIndex) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
    setIsComplete(false);
  };

  if (questions.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No questions available.</p>
      </div>
    );
  }

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <div className="mb-6">
          <div className="text-6xl font-bold text-white mb-2">{percentage}%</div>
          <p className="text-white/60">
            You got {score} out of {questions.length} correct
          </p>
        </div>

        <div className="w-full bg-white/10 rounded-full h-3 mb-8">
          <div
            className="bg-[#e63946] h-3 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <Button onClick={handleRestart} className="bg-[#e63946] hover:bg-[#e63946]/90">
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      {title && <h3 className="text-lg font-medium text-white mb-4">{title}</h3>}

      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-white/60">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-sm text-white/60">Score: {score}</span>
      </div>

      <div className="w-full bg-white/10 rounded-full h-1.5 mb-6">
        <div
          className="bg-[#e63946] h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <h4 className="text-xl font-medium text-white mb-6">{currentQuestion.question}</h4>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectOption = index === currentQuestion.correctIndex;

          return (
            <button
              key={index}
              onClick={() => !isSubmitted && setSelectedOption(index)}
              disabled={isSubmitted}
              className={cn(
                'w-full text-left p-4 rounded-xl border transition-all',
                !isSubmitted && isSelected && 'border-[#e63946] bg-[#e63946]/10',
                !isSubmitted && !isSelected && 'border-white/10 bg-white/5 hover:bg-white/10',
                isSubmitted && isCorrectOption && 'border-green-500 bg-green-500/10',
                isSubmitted && isSelected && !isCorrectOption && 'border-red-500 bg-red-500/10',
                isSubmitted && !isSelected && !isCorrectOption && 'border-white/10 bg-white/5 opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-[#e63946]' : 'border-white/30'
                  )}
                >
                  {isSelected && <div className="w-3 h-3 rounded-full bg-[#e63946]" />}
                </div>
                <span className="text-white">{option}</span>
                {isSubmitted && isCorrectOption && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                )}
                {isSubmitted && isSelected && !isCorrectOption && (
                  <XCircle className="w-5 h-5 text-red-500 ml-auto" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {isSubmitted && currentQuestion.explanation && (
        <div
          className={cn(
            'p-4 rounded-xl mb-6',
            isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          )}
        >
          <p className="text-sm text-white/80">{currentQuestion.explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {!isSubmitted ? (
          <Button
            onClick={handleSubmit}
            disabled={selectedOption === null}
            className="bg-[#e63946] hover:bg-[#e63946]/90"
          >
            Submit Answer
          </Button>
        ) : (
          <Button onClick={handleNext} className="bg-[#e63946] hover:bg-[#e63946]/90">
            {currentIndex < questions.length - 1 ? (
              <>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              'See Results'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
