export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface ParsedOutput {
  type: 'flashcards' | 'quiz' | 'slides' | 'markdown' | 'file';
  data: Flashcard[] | QuizQuestion[] | string;
  raw?: string;
}

export function parseAgentOutput(content: string, outputType?: string): ParsedOutput {
  if (!content || typeof content !== 'string') {
    return { type: 'markdown', data: content || '', raw: content };
  }

  // Try to detect flashcards
  if (content.includes('**Flashcard') || content.includes('**Front:**') || outputType === 'flashcards') {
    const flashcards = parseFlashcardsFromMarkdown(content);
    if (flashcards.length > 0) {
      return { type: 'flashcards', data: flashcards, raw: content };
    }
  }

  // Try to detect quiz
  if (content.includes('**Question') || content.match(/[A-D]\)/) || outputType === 'quiz') {
    const questions = parseQuizFromMarkdown(content);
    if (questions.length > 0) {
      return { type: 'quiz', data: questions, raw: content };
    }
  }

  // Default to markdown
  return { type: 'markdown', data: content, raw: content };
}

function parseFlashcardsFromMarkdown(content: string): Flashcard[] {
  const flashcards: Flashcard[] = [];
  
  // Pattern 1: **Flashcard N** with **Front:** and **Back:**
  const pattern1 = /\*\*Flashcard\s*(\d+)\*\*[^*]*\*\*Front:\*\*\s*([^*]+?)\s*\*\*Back:\*\*\s*([^*]+?)(?=\*\*Flashcard|\n---|\n\n\*\*|$)/gi;
  let match;
  
  while ((match = pattern1.exec(content)) !== null) {
    flashcards.push({
      id: `fc-${match[1]}`,
      front: cleanText(match[2]),
      back: cleanText(match[3]),
    });
  }

  // Pattern 2: Numbered list with Front/Back
  if (flashcards.length === 0) {
    const pattern2 = /(?:^|\n)\s*\d+\.\s*\*\*Front:\*\*\s*(.+?)(?:\n\s*)\*\*Back:\*\*\s*(.+?)(?=\n\s*\d+\.|$)/gis;
    let idx = 0;
    while ((match = pattern2.exec(content)) !== null) {
      flashcards.push({
        id: `fc-${++idx}`,
        front: cleanText(match[1]),
        back: cleanText(match[2]),
      });
    }
  }

  // Pattern 3: Simple Front: / Back: pairs
  if (flashcards.length === 0) {
    const pattern3 = /(?:Front|Q):\s*(.+?)(?:\n|$)\s*(?:Back|A):\s*(.+?)(?=(?:Front|Q):|$)/gi;
    let idx = 0;
    while ((match = pattern3.exec(content)) !== null) {
      flashcards.push({
        id: `fc-${++idx}`,
        front: cleanText(match[1]),
        back: cleanText(match[2]),
      });
    }
  }

  // Pattern 4: Markdown headers ## Front / ## Back
  if (flashcards.length === 0) {
    const blocks = content.split(/(?=##\s*Card|\*\*Card)/i);
    blocks.forEach((block, idx) => {
      const frontMatch = block.match(/(?:Front|Question)[:\s]*\n?(.+?)(?=Back|Answer|$)/is);
      const backMatch = block.match(/(?:Back|Answer)[:\s]*\n?(.+?)(?=##|$)/is);
      if (frontMatch && backMatch) {
        flashcards.push({
          id: `fc-${idx + 1}`,
          front: cleanText(frontMatch[1]),
          back: cleanText(backMatch[1]),
        });
      }
    });
  }

  return flashcards;
}

function parseQuizFromMarkdown(content: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  // Split by question markers
  const questionBlocks = content.split(/\*\*Question\s*\d+\*\*/i).filter(Boolean);
  
  if (questionBlocks.length === 0) {
    // Try alternate pattern: numbered questions
    const altBlocks = content.split(/(?=\d+\.\s+(?:\*\*)?[^A-D])/).filter(b => b.match(/^\d+\./));
    questionBlocks.push(...altBlocks);
  }
  
  questionBlocks.forEach((block, idx) => {
    // Extract question text (before first option)
    const questionMatch = block.match(/^[:\s]*(.+?)(?=\n\s*[A-D]\)|$)/s);
    if (!questionMatch) return;

    const options: string[] = [];
    const optionMatches = [...block.matchAll(/([A-D])\)\s*(.+?)(?=\n[A-D]\)|\n\n|\*\*Correct|\*\*Answer|$)/gi)];
    
    for (const optMatch of optionMatches) {
      options.push(cleanText(optMatch[2]));
    }

    if (options.length >= 2) {
      // Try to find correct answer marker
      const correctMatch = block.match(/(?:correct|answer)[:\s]*\*?\*?([A-D])/i);
      let correctIndex = 0;
      
      if (correctMatch) {
        correctIndex = correctMatch[1].toUpperCase().charCodeAt(0) - 65;
      }

      // Extract explanation if present
      const explanationMatch = block.match(/(?:explanation|reason)[:\s]*(.+?)(?=\n\n|$)/is);

      questions.push({
        id: `q-${idx + 1}`,
        question: cleanText(questionMatch[1]),
        options,
        correctIndex: Math.min(correctIndex, options.length - 1),
        explanation: explanationMatch ? cleanText(explanationMatch[1]) : undefined,
      });
    }
  });

  return questions;
}

function cleanText(text: string): string {
  return text
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/\n+/g, ' ')
    .trim();
}
