import { useMemo, useState, useRef } from 'react';
import { Play, Pause, Download, FileText, Volume2, Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface TaskResult {
  script?: string;
  audio_url?: string | null;
  audio_base64?: string | null;
  script_url?: string;
  output_type?: string;
  content?: string;
  text?: string;
  flashcards?: Array<{ front: string; back: string }>;
  questions?: Array<{ question: string; options: string[]; correct: number; correctIndex?: number; explanation?: string }>;
  [key: string]: unknown;
}

interface TaskResultRendererProps {
  result: TaskResult | string | null;
  artifactType?: string;
  className?: string;
}

export function TaskResultRenderer({ result, artifactType, className }: TaskResultRendererProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Parse result if it's a string
  const parsed: TaskResult = useMemo(() => {
    if (!result) return {};
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return { content: result };
      }
    }
    return result as TaskResult;
  }, [result]);

  // Determine output type
  const outputType = parsed.output_type || artifactType || 'text';

  // Generate audio from script using TTS
  const handleGenerateAudio = async () => {
    if (!parsed.script) return;
    
    setIsGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: {
          text: parsed.script.slice(0, 5000), // Limit text length
          voice: 'Kore',
          speed: 1.0
        }
      });

      if (error) throw error;
      if (data?.audio_base64) {
        const audioBlob = base64ToBlob(data.audio_base64, 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      } else if (data?.audio_url) {
        setAudioUrl(data.audio_url);
      }
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    const url = audioUrl || parsed.audio_url;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'podcast.mp3';
      a.click();
    }
  };

  // Audio/Podcast output
  if (outputType === 'audio' || outputType === 'podcast' || outputType === 'script' || parsed.script) {
    const finalAudioUrl = audioUrl || parsed.audio_url;
    
    return (
      <div className={cn("space-y-4", className)}>
        {/* Audio Player */}
        {finalAudioUrl ? (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <div className="flex-1">
                <p className="font-medium text-foreground">Generated Audio</p>
                <p className="text-sm text-muted-foreground">AI Podcast</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <audio
              ref={audioRef}
              id="task-audio"
              src={finalAudioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              className="w-full"
              controls
            />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Volume2 className="h-5 w-5" />
                <span>Audio not yet generated</span>
              </div>
              <Button 
                onClick={handleGenerateAudio} 
                disabled={isGeneratingAudio || !parsed.script}
                className="bg-primary hover:bg-primary/90"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Generate Audio
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Script/Transcript */}
        {parsed.script && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Script</span>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {parsed.script}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Flashcards output
  if (outputType === 'flashcards' || parsed.flashcards) {
    const cards = parsed.flashcards || parseFlashcardsFromText(parsed.content || parsed.text || '');
    return <FlashcardsDisplay cards={cards} className={className} />;
  }

  // Quiz output
  if (outputType === 'quiz' || parsed.questions) {
    const questions = parsed.questions || parseQuizFromText(parsed.content || parsed.text || '');
    return <QuizDisplay questions={questions} className={className} />;
  }

  // Default: render as markdown
  const content = parsed.content || parsed.script || parsed.text || 
    (typeof result === 'string' ? result : JSON.stringify(parsed, null, 2));

  return (
    <div className={cn("bg-card border border-border rounded-xl p-6", className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

// Flashcards Display Component
function FlashcardsDisplay({ cards, className }: { cards: Array<{ front: string; back: string }>; className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());

  if (!cards || cards.length === 0) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-6 text-center", className)}>
        <p className="text-muted-foreground">No flashcards available</p>
      </div>
    );
  }

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleKnow = () => {
    setKnownCards(prev => new Set(prev).add(currentIndex));
    handleNext();
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl p-6", className)}>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
        </span>
        <span className="text-sm text-green-600 dark:text-green-400">
          Known: {knownCards.size}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="relative cursor-pointer mb-4 perspective-1000"
      >
        <div
          className={cn(
            "relative w-full min-h-[200px] transition-transform duration-500 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
        >
          {/* Front */}
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-muted border border-border rounded-xl backface-hidden">
            <p className="text-lg text-foreground text-center">{cards[currentIndex]?.front}</p>
          </div>

          {/* Back */}
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-primary/10 border border-primary/30 rounded-xl backface-hidden rotate-y-180">
            <p className="text-lg text-foreground text-center">{cards[currentIndex]?.back}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mb-4">Click card to flip</p>

      {/* Actions when flipped */}
      {isFlipped && (
        <div className="flex justify-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setIsFlipped(false); handleNext(); }}
            className="border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
          >
            Study More
          </Button>
          <Button
            size="sm"
            onClick={handleKnow}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Know It
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCurrentIndex(0);
            setIsFlipped(false);
            setKnownCards(new Set());
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restart
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// Quiz Display Component
function QuizDisplay({ questions, className }: { questions: Array<{ question: string; options: string[]; correct: number; correctIndex?: number; explanation?: string }>; className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-6 text-center", className)}>
        <p className="text-muted-foreground">No quiz questions available</p>
      </div>
    );
  }

  const q = questions[currentIndex];
  const correctIndex = q.correctIndex ?? q.correct ?? 0;

  const handleSelect = (index: number) => {
    if (showAnswer) return;
    setSelected(index);
    setShowAnswer(true);
    if (index === correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelected(null);
      setShowAnswer(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelected(null);
    setShowAnswer(false);
    setScore(0);
    setIsComplete(false);
  };

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className={cn("bg-card border border-border rounded-xl p-8 text-center", className)}>
        <div className="text-5xl font-bold text-foreground mb-2">{percentage}%</div>
        <p className="text-muted-foreground mb-6">
          You got {score} out of {questions.length} correct
        </p>
        <div className="w-full bg-muted rounded-full h-2 mb-6">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <Button onClick={handleRestart} className="bg-primary hover:bg-primary/90">
          <RotateCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl p-6", className)}>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-sm text-muted-foreground">Score: {score}</span>
      </div>

      <div className="w-full bg-muted rounded-full h-1.5 mb-6">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-lg font-medium text-foreground mb-6">{q?.question}</p>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {q?.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={showAnswer}
            className={cn(
              "w-full text-left p-4 rounded-xl border transition-all",
              !showAnswer && selected === i && "border-primary bg-primary/10",
              !showAnswer && selected !== i && "border-border bg-muted hover:bg-accent",
              showAnswer && i === correctIndex && "border-green-500 bg-green-500/10",
              showAnswer && selected === i && i !== correctIndex && "border-red-500 bg-red-500/10",
              showAnswer && selected !== i && i !== correctIndex && "border-border bg-muted opacity-50"
            )}
          >
            <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
            <span className="text-foreground">{opt}</span>
          </button>
        ))}
      </div>

      {/* Explanation */}
      {showAnswer && q?.explanation && (
        <div className={cn(
          "p-4 rounded-xl mb-6",
          selected === correctIndex ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
        )}>
          <p className="text-sm text-foreground/80">{q.explanation}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end">
        {showAnswer && (
          <Button onClick={handleNext} className="bg-primary hover:bg-primary/90">
            {currentIndex < questions.length - 1 ? (
              <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
            ) : (
              'See Results'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Helper: Convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper: Parse flashcards from markdown text
function parseFlashcardsFromText(text: string): Array<{ front: string; back: string }> {
  const cards: Array<{ front: string; back: string }> = [];
  
  // Pattern 1: **Front:** / **Back:**
  const pattern1 = /\*\*Front:\*\*\s*(.+?)\s*\*\*Back:\*\*\s*(.+?)(?=\*\*Front:\*\*|\*\*Flashcard|$)/gis;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    cards.push({ front: match[1].trim(), back: match[2].trim() });
  }
  
  // Pattern 2: Numbered with Front/Back
  if (cards.length === 0) {
    const pattern2 = /\d+\.\s*\*\*Front:\*\*\s*(.+?)\s*\*\*Back:\*\*\s*(.+?)(?=\d+\.\s*\*\*Front|\n\n|$)/gis;
    while ((match = pattern2.exec(text)) !== null) {
      cards.push({ front: match[1].trim(), back: match[2].trim() });
    }
  }
  
  return cards;
}

// Helper: Parse quiz from markdown text
function parseQuizFromText(text: string): Array<{ question: string; options: string[]; correct: number }> {
  const questions: Array<{ question: string; options: string[]; correct: number }> = [];
  
  // Split by question patterns
  const questionBlocks = text.split(/\*\*Question\s*\d+\*\*/i).filter(Boolean);
  
  questionBlocks.forEach(block => {
    const questionMatch = block.match(/^[:\s]*(.+?)(?=\n\s*[A-D]\)|$)/s);
    if (!questionMatch) return;

    const options: string[] = [];
    const optionMatches = [...block.matchAll(/([A-D])\)\s*(.+?)(?=\n[A-D]\)|\n\n|\*\*Correct|$)/gi)];
    
    for (const optMatch of optionMatches) {
      options.push(optMatch[2].trim());
    }

    if (options.length >= 2) {
      const correctMatch = block.match(/(?:correct|answer)[:\s]*\*?\*?([A-D])/i);
      const correctIndex = correctMatch ? correctMatch[1].toUpperCase().charCodeAt(0) - 65 : 0;

      questions.push({
        question: questionMatch[1].trim(),
        options,
        correct: Math.min(correctIndex, options.length - 1),
      });
    }
  });

  return questions;
}
