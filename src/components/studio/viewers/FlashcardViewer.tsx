import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shuffle, Check, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardViewerProps {
  cards: Flashcard[];
  title?: string;
}

export function FlashcardViewer({ cards: initialCards, title }: FlashcardViewerProps) {
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [studyMoreCards, setStudyMoreCards] = useState<Set<string>>(new Set());

  const currentCard = cards[currentIndex];

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
      studyMoreCards.delete(currentCard.id);
      setStudyMoreCards(new Set(studyMoreCards));
    }
    handleNext();
  };

  const handleStudyMore = () => {
    if (currentCard) {
      setStudyMoreCards((prev) => new Set(prev).add(currentCard.id));
      knownCards.delete(currentCard.id);
      setKnownCards(new Set(knownCards));
    }
    handleNext();
  };

  if (cards.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No flashcards available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {title && <h3 className="text-lg font-medium text-foreground mb-4">{title}</h3>}

      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
        </span>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="text-green-600 dark:text-green-400">Known: {knownCards.size}</span>
          <span className="text-yellow-600 dark:text-yellow-400">Study: {studyMoreCards.size}</span>
        </div>
      </div>

      {/* Card */}
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
            className="absolute inset-0 flex items-center justify-center p-8 bg-muted border border-border rounded-xl backface-hidden"
          >
            <p className="text-xl text-foreground text-center">{currentCard?.front}</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex items-center justify-center p-8 bg-primary/10 border border-primary/30 rounded-xl backface-hidden rotate-y-180"
          >
            <p className="text-xl text-foreground text-center">{currentCard?.back}</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">Click card to flip</p>
      </div>

      {/* Know It / Study More */}
      {isFlipped && (
        <div className="flex justify-center gap-3 mb-6">
          <Button
            onClick={handleKnowIt}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Know It
          </Button>
          <Button
            onClick={handleStudyMore}
            variant="outline"
            className="border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Study More
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
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
          onClick={handleShuffle}
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Shuffle className="w-4 h-4 mr-2" />
          Shuffle
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
    </div>
  );
}
