import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shuffle, Check, BookOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StylePreset, getStyleConfig } from '@/lib/stylePresets';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardViewerProps {
  cards: Flashcard[];
  title?: string;
  style?: StylePreset;
}

export function FlashcardViewer({ cards: initialCards, title, style = 'corporate' }: FlashcardViewerProps) {
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [studyMoreCards, setStudyMoreCards] = useState<Set<string>>(new Set());

  const styleConfig = getStyleConfig(style);
  const currentCard = cards[currentIndex];
  const progress = (knownCards.size / cards.length) * 100;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleShuffle = useCallback(() => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards]);

  const handleKnowIt = () => {
    if (currentCard) {
      setKnownCards((prev) => new Set(prev).add(currentCard.id));
      setStudyMoreCards((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
    }
    handleNext();
  };

  const handleStudyMore = () => {
    if (currentCard) {
      setStudyMoreCards((prev) => new Set(prev).add(currentCard.id));
      setKnownCards((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
    }
    handleNext();
  };

  const handleReset = () => {
    setCards(initialCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setStudyMoreCards(new Set());
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          handleFlip();
          break;
        case 'g':
        case 'G':
          if (isFlipped) handleKnowIt();
          break;
        case 'l':
        case 'L':
          if (isFlipped) handleStudyMore();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped]);

  if (cards.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No flashcards available.</p>
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
          Card {currentIndex + 1} of {cards.length}
        </span>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">{knownCards.size} mastered</span>
          <span className="text-amber-600">{studyMoreCards.size} learning</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div className="flex h-full">
          <div 
            className="bg-green-500 transition-all duration-300" 
            style={{ width: `${progress}%` }} 
          />
          <div 
            className="bg-amber-500 transition-all duration-300" 
            style={{ width: `${(studyMoreCards.size / cards.length) * 100}%` }} 
          />
        </div>
      </div>

      {/* Card with 3D flip animation */}
      <div
        onClick={handleFlip}
        className="relative cursor-pointer mb-6 perspective-1000"
      >
        <div
          className={cn(
            'relative w-full min-h-[280px] transition-transform duration-500 transform-style-3d',
            isFlipped && 'rotate-y-180'
          )}
        >
          {/* Front */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center p-8 rounded-xl backface-hidden',
              styleConfig.flashcard.front
            )}
          >
            <span className="text-xs opacity-70 mb-4 uppercase tracking-wide">Question</span>
            <p className="text-xl text-center">{currentCard?.front}</p>
          </div>

          {/* Back */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center p-8 rounded-xl backface-hidden rotate-y-180',
              styleConfig.flashcard.back
            )}
          >
            <span className="text-xs opacity-70 mb-4 uppercase tracking-wide">Answer</span>
            <p className="text-xl text-center">{currentCard?.back}</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {isFlipped ? 'Click to see question' : 'Click to reveal answer'} • Space to flip
        </p>
      </div>

      {/* Know It / Study More buttons */}
      {isFlipped && (
        <div className="flex justify-center gap-3 mb-6 animate-fade-in">
          <Button
            onClick={handleStudyMore}
            variant="outline"
            className="border-amber-500 text-amber-600 hover:bg-amber-500/10"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Still Learning (L)
          </Button>
          <Button
            onClick={handleKnowIt}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Got It (G)
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={handleShuffle}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
          <Button
            variant="ghost"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
