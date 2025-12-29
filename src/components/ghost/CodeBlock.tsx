import { useState, useEffect, useRef } from 'react';
import { Check, Copy } from '@/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js/lib/core';

// Import only the languages we need
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml'; // HTML
import css from 'highlight.js/lib/languages/css';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  python: 'Python',
  py: 'Python',
  json: 'JSON',
  sql: 'SQL',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  html: 'HTML',
  xml: 'XML',
  css: 'CSS',
};

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language = '', showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const normalizedLang = language.toLowerCase().trim();
  const displayLabel = LANGUAGE_LABELS[normalizedLang] || language.toUpperCase() || 'CODE';

  useEffect(() => {
    if (codeRef.current && normalizedLang) {
      try {
        // Reset any previous highlighting
        codeRef.current.removeAttribute('data-highlighted');
        hljs.highlightElement(codeRef.current);
      } catch (e) {
        // Language not supported, leave as plain text
      }
    }
  }, [code, normalizedLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="relative group rounded-lg overflow-hidden my-3 border border-slate-600/50 bg-slate-800/80">
      {/* Header with language badge and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-700/50 border-b border-slate-600/50">
        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wide">
          {displayLabel}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className={cn(
            'h-7 px-2 text-xs gap-1.5 transition-all',
            copied
              ? 'text-green-400 hover:text-green-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-600/50'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          {showLineNumbers ? (
            <code ref={codeRef} className={`language-${normalizedLang} block`}>
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none text-slate-500 text-right pr-4 w-8 flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{line || ' '}</span>
                </div>
              ))}
            </code>
          ) : (
            <code
              ref={codeRef}
              className={`language-${normalizedLang}`}
            >
              {code}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
}
