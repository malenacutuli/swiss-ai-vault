import { useMemo } from 'react';
import { CodeBlock } from './CodeBlock';
import { cn } from '@/lib/utils';

interface GhostMessageProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp?: number;
  onRegenerate?: () => void;
}

// Parse content into segments of text and code blocks
interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        segments.push({ type: 'text', content: text });
      }
    }

    // Add the code block
    segments.push({
      type: 'code',
      language: match[1] || '',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: 'text', content: text });
    }
  }

  // If no segments were found, treat entire content as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

// Simple inline code and bold/italic parsing for text segments
function renderTextContent(text: string): React.ReactNode {
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      // Inline code
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 bg-slate-700/50 rounded text-purple-300 text-sm font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    
    // Handle **bold** and *italic*
    let processed = part;
    
    // Bold
    processed = processed.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-semibold">$1</strong>'
    );
    
    // Italic
    processed = processed.replace(
      /\*([^*]+)\*/g,
      '<em class="italic">$1</em>'
    );
    
    if (processed !== part) {
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    }
    
    return <span key={i}>{part}</span>;
  });
}

export function GhostMessage({ content, role, timestamp, onRegenerate }: GhostMessageProps) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={segment.content}
              language={segment.language}
            />
          );
        }

        // Text segment - render with basic markdown parsing
        return (
          <div key={index} className="text-sm whitespace-pre-wrap leading-relaxed">
            {renderTextContent(segment.content)}
          </div>
        );
      })}
    </div>
  );
}
