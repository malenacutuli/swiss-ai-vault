import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StylePreset, getStyleConfig } from '@/lib/stylePresets';

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
  style?: StylePreset;
}

export function QuizViewer({ questions, title, style = 'corporate' }: QuizViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const styleConfig = getStyleConfig(style);
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
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No questions available.</p>
      </div>
    );
  }

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center animate-scale-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: styleConfig.colors.primary + '20' }}>
          <Trophy className="w-10 h-10" style={{ color: styleConfig.colors.primary }} />
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-2">Quiz Complete!</h2>
        <p className="text-muted-foreground mb-6">
          You got {score} out of {questions.length} correct
        </p>

        <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-4 mb-2 overflow-hidden">
          <div
            className={cn('h-4 rounded-full transition-all duration-500', styleConfig.quiz.progressBar)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-3xl font-bold mb-6" style={{ color: styleConfig.colors.primary }}>
          {percentage}%
        </p>

        <Button onClick={handleRestart} className="bg-primary hover:bg-primary/90">
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {title && (
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: styleConfig.colors.primary + '20',
              color: styleConfig.colors.primary 
            }}
          >
            {styleConfig.name.split(' ')[0]}
          </span>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-sm font-medium" style={{ color: styleConfig.colors.primary }}>
          Score: {score}
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-1.5 mb-6 overflow-hidden">
        <div
          className={cn('h-1.5 rounded-full transition-all', styleConfig.quiz.progressBar)}
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <h4 className="text-xl font-medium text-foreground mb-6">{currentQuestion.question}</h4>

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
                'w-full text-left p-4 rounded-xl border-2 transition-all',
                !isSubmitted && styleConfig.quiz.default,
                !isSubmitted && isSelected && styleConfig.quiz.selected,
                isSubmitted && isCorrectOption && styleConfig.quiz.correct,
                isSubmitted && isSelected && !isCorrectOption && styleConfig.quiz.incorrect,
                isSubmitted && !isSelected && !isCorrectOption && 'border-border bg-muted opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-current' : 'border-muted-foreground/30'
                  )}
                  style={{ borderColor: isSelected ? styleConfig.colors.primary : undefined }}
                >
                  {isSelected && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: styleConfig.colors.primary }}
                    />
                  )}
                </div>
                <span className="text-foreground">{option}</span>
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
            'p-4 rounded-xl mb-6 border animate-fade-in',
            isCorrect 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          )}
        >
          <p className="text-sm font-medium mb-1" style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          <p className="text-sm text-foreground/80">{currentQuestion.explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {!isSubmitted ? (
          <Button
            onClick={handleSubmit}
            disabled={selectedOption === null}
            style={{ backgroundColor: styleConfig.colors.primary }}
            className="hover:opacity-90"
          >
            Submit Answer
          </Button>
        ) : (
          <Button 
            onClick={handleNext} 
            style={{ backgroundColor: styleConfig.colors.primary }}
            className="hover:opacity-90"
          >
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
