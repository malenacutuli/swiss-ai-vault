import React, { useCallback } from 'react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { useEffect } from 'react';

// Swiss-themed Monaco colors (inline type to avoid monaco-editor dependency)
interface MonacoThemeData {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: Array<{ token: string; foreground?: string; fontStyle?: string }>;
  colors: Record<string, string>;
}
const SWISS_LIGHT_THEME: MonacoThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: '1D4E5F', fontStyle: 'bold' },
    { token: 'string', foreground: '722F37' },
    { token: 'number', foreground: 'B8860B' },
    { token: 'type', foreground: '1D4E5F' },
    { token: 'function', foreground: '2563eb' },
    { token: 'variable', foreground: '1a1a1a' },
    { token: 'constant', foreground: 'B8860B' },
    { token: 'operator', foreground: '71717a' },
  ],
  colors: {
    'editor.background': '#FAFAF8',
    'editor.foreground': '#1a1a1a',
    'editor.lineHighlightBackground': '#f3f3f0',
    'editor.selectionBackground': '#1D4E5F30',
    'editor.inactiveSelectionBackground': '#1D4E5F15',
    'editorCursor.foreground': '#1D4E5F',
    'editorLineNumber.foreground': '#9ca3af',
    'editorLineNumber.activeForeground': '#1D4E5F',
    'editorIndentGuide.background': '#e5e5e5',
    'editorIndentGuide.activeBackground': '#1D4E5F50',
    'editorBracketMatch.background': '#1D4E5F20',
    'editorBracketMatch.border': '#1D4E5F',
    'scrollbarSlider.background': '#1D4E5F20',
    'scrollbarSlider.hoverBackground': '#1D4E5F40',
    'scrollbarSlider.activeBackground': '#1D4E5F60',
  },
};

const SWISS_DARK_THEME: MonacoThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: '4EC9B0', fontStyle: 'bold' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'constant', foreground: 'B5CEA8' },
    { token: 'operator', foreground: 'D4D4D4' },
  ],
  colors: {
    'editor.background': '#0a0a0f',
    'editor.foreground': '#e4e4e7',
    'editor.lineHighlightBackground': '#1a1a2e',
    'editor.selectionBackground': '#4EC9B040',
    'editor.inactiveSelectionBackground': '#4EC9B020',
    'editorCursor.foreground': '#4EC9B0',
    'editorLineNumber.foreground': '#6b7280',
    'editorLineNumber.activeForeground': '#4EC9B0',
    'editorIndentGuide.background': '#2a2a3e',
    'editorIndentGuide.activeBackground': '#4EC9B050',
    'editorBracketMatch.background': '#4EC9B020',
    'editorBracketMatch.border': '#4EC9B0',
    'scrollbarSlider.background': '#4EC9B020',
    'scrollbarSlider.hoverBackground': '#4EC9B040',
    'scrollbarSlider.activeBackground': '#4EC9B060',
  },
};

// Language detection from file extension
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    pyw: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    md: 'markdown',
    mdx: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    docker: 'dockerfile',
    graphql: 'graphql',
    gql: 'graphql',
    vue: 'vue',
    svelte: 'svelte',
    tf: 'hcl',
    prisma: 'prisma',
    env: 'ini',
    ini: 'ini',
    conf: 'ini',
    txt: 'plaintext',
    log: 'plaintext',
  };
  return languageMap[ext || ''] || 'plaintext';
}

interface CodeEditorProps {
  content: string;
  language?: string;
  filename?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  originalContent?: string; // For diff view
  height?: string | number;
  className?: string;
  showLineNumbers?: boolean;
  showMinimap?: boolean;
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
}

export function CodeEditor({
  content,
  language,
  filename,
  readOnly = true,
  onChange,
  originalContent,
  height = '100%',
  className,
  showLineNumbers = true,
  showMinimap = false,
  wordWrap = 'off',
}: CodeEditorProps) {
  const monaco = useMonaco();

  // Determine language from filename if not provided
  const detectedLanguage = language || (filename ? detectLanguage(filename) : 'plaintext');

  // Register custom themes
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('swiss-light', SWISS_LIGHT_THEME);
      monaco.editor.defineTheme('swiss-dark', SWISS_DARK_THEME);
    }
  }, [monaco]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    onChange?.(value || '');
  }, [onChange]);

  // Editor options
  const editorOptions = {
    readOnly,
    minimap: { enabled: showMinimap },
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
    fontLigatures: true,
    lineNumbers: showLineNumbers ? 'on' : 'off',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap,
    padding: { top: 12, bottom: 12 },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    bracketPairColorization: { enabled: true },
    guides: {
      indentation: true,
      bracketPairs: true,
    },
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
  };

  // Diff editor options
  const diffOptions = {
    readOnly: true,
    renderSideBySide: true,
    originalEditable: false,
    enableSplitViewResizing: true,
    ...editorOptions,
  };

  // Use light theme for Swiss design
  const theme = 'swiss-light';

  if (originalContent !== undefined) {
    return (
      <div className={className} style={{ height }}>
        <DiffEditor
          original={originalContent}
          modified={content}
          language={detectedLanguage}
          theme={theme}
          options={diffOptions}
          height="100%"
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <Editor
        value={content}
        language={detectedLanguage}
        theme={theme}
        onChange={handleEditorChange}
        options={editorOptions}
        height="100%"
        loading={
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
