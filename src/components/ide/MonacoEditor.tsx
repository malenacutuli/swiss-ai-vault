import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { useMonaco, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { cn } from '@/lib/utils';

// Extended language detection (50+ languages)
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    // Python
    py: 'python',
    pyw: 'python',
    pyi: 'python',
    // Systems
    rs: 'rust',
    go: 'go',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    hxx: 'cpp',
    // JVM
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    groovy: 'groovy',
    // .NET
    cs: 'csharp',
    fs: 'fsharp',
    vb: 'vb',
    // Ruby/PHP
    rb: 'ruby',
    php: 'php',
    // Swift/Objective-C
    swift: 'swift',
    m: 'objective-c',
    mm: 'objective-c',
    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    vue: 'vue',
    svelte: 'svelte',
    // Data
    json: 'json',
    jsonc: 'jsonc',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    csv: 'plaintext',
    // Config
    ini: 'ini',
    conf: 'ini',
    env: 'ini',
    properties: 'ini',
    // Markup
    md: 'markdown',
    mdx: 'markdown',
    rst: 'restructuredtext',
    tex: 'latex',
    // Shell
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    bat: 'bat',
    cmd: 'bat',
    // Database
    sql: 'sql',
    mysql: 'mysql',
    pgsql: 'pgsql',
    // DevOps
    dockerfile: 'dockerfile',
    docker: 'dockerfile',
    tf: 'hcl',
    hcl: 'hcl',
    // GraphQL
    graphql: 'graphql',
    gql: 'graphql',
    // Others
    r: 'r',
    lua: 'lua',
    perl: 'perl',
    pl: 'perl',
    clj: 'clojure',
    cljs: 'clojure',
    erl: 'erlang',
    ex: 'elixir',
    exs: 'elixir',
    hs: 'haskell',
    ml: 'ocaml',
    prisma: 'prisma',
    proto: 'protobuf',
    makefile: 'makefile',
    cmake: 'cmake',
    txt: 'plaintext',
    log: 'plaintext',
  };
  
  // Handle special filenames
  const filenameMap: Record<string, string> = {
    'Dockerfile': 'dockerfile',
    'Makefile': 'makefile',
    'CMakeLists.txt': 'cmake',
    '.gitignore': 'ignore',
    '.dockerignore': 'ignore',
    '.env': 'ini',
    '.env.local': 'ini',
    '.env.production': 'ini',
  };
  
  const basename = filename.split('/').pop() || '';
  return filenameMap[basename] || languageMap[ext || ''] || 'plaintext';
}

// Monaco theme - Swiss design inspired
const SWISS_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: '1D4E5F', fontStyle: 'bold' },
    { token: 'string', foreground: '059669' },
    { token: 'number', foreground: 'd97706' },
    { token: 'type', foreground: '7c3aed' },
    { token: 'function', foreground: '2563eb' },
    { token: 'variable', foreground: '1a1a1a' },
    { token: 'constant', foreground: 'd97706' },
    { token: 'operator', foreground: '71717a' },
    { token: 'delimiter', foreground: '71717a' },
    { token: 'tag', foreground: '1D4E5F' },
    { token: 'attribute.name', foreground: '7c3aed' },
    { token: 'attribute.value', foreground: '059669' },
  ],
  colors: {
    'editor.background': '#FAFAFA',
    'editor.foreground': '#1a1a1a',
    'editor.lineHighlightBackground': '#f5f5f5',
    'editor.selectionBackground': '#1D4E5F30',
    'editor.inactiveSelectionBackground': '#1D4E5F15',
    'editorCursor.foreground': '#1D4E5F',
    'editorLineNumber.foreground': '#9ca3af',
    'editorLineNumber.activeForeground': '#1D4E5F',
    'editorIndentGuide.background': '#e5e7eb',
    'editorIndentGuide.activeBackground': '#1D4E5F40',
    'editorBracketMatch.background': '#1D4E5F20',
    'editorBracketMatch.border': '#1D4E5F',
    'editorBracketHighlight.foreground1': '#1D4E5F',
    'editorBracketHighlight.foreground2': '#7c3aed',
    'editorBracketHighlight.foreground3': '#d97706',
    'scrollbarSlider.background': '#1D4E5F20',
    'scrollbarSlider.hoverBackground': '#1D4E5F40',
    'scrollbarSlider.activeBackground': '#1D4E5F60',
    'minimap.background': '#FAFAFA',
  },
};

interface MonacoEditorProps {
  value: string;
  language?: string;
  path?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
}

export function MonacoEditor({
  value,
  language,
  path,
  onChange,
  onSave,
  onCursorChange,
  readOnly = false,
  height = '100%',
  className,
}: MonacoEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Determine language from path if not provided
  const detectedLanguage = language || (path ? detectLanguage(path) : 'plaintext');

  // Register custom theme
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('swiss', SWISS_THEME);
    }
  }, [monaco]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure TypeScript/JavaScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      strict: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
    });

    // Enable auto-imports
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    // Keyboard shortcuts
    // Cmd/Ctrl+S - Save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.(editor.getValue());
    });

    // Cmd/Ctrl+G - Go to line
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.gotoLine')?.run();
    });

    // Format document
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run();
      }
    );
  }, [onCursorChange, onSave]);

  const handleChange = useCallback((value: string | undefined) => {
    onChange?.(value || '');
  }, [onChange]);

  // Editor options
  const options: editor.IStandaloneEditorConstructionOptions = {
    readOnly,
    minimap: { enabled: true },
    fontSize: 13,
    fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Menlo, monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'off',
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
      highlightActiveBracketPair: true,
    },
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: 'multiline',
      seedSearchStringFromSelection: 'selection',
    },
    suggest: {
      showKeywords: true,
      showSnippets: true,
      showClasses: true,
      showFunctions: true,
      showVariables: true,
      showModules: true,
      preview: true,
      previewMode: 'prefix',
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    parameterHints: { enabled: true },
    hover: { enabled: true, delay: 300 },
    formatOnPaste: true,
    formatOnType: true,
  };

  return (
    <div className={cn('h-full', className)} style={{ height }}>
      <Editor
        value={value}
        language={detectedLanguage}
        theme="swiss"
        onChange={handleChange}
        onMount={handleEditorMount}
        options={options}
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
