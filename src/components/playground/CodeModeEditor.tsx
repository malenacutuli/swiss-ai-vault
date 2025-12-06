import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Lightbulb,
  Bug,
  Zap,
  MessageSquare,
  Languages,
  TestTube,
  Play,
  Copy,
  Check,
  ChevronDown,
  History,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { id: "python", name: "Python" },
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "java", name: "Java" },
  { id: "go", name: "Go" },
  { id: "rust", name: "Rust" },
  { id: "cpp", name: "C++" },
  { id: "csharp", name: "C#" },
  { id: "ruby", name: "Ruby" },
  { id: "php", name: "PHP" },
  { id: "swift", name: "Swift" },
  { id: "kotlin", name: "Kotlin" },
];

const CODE_ACTIONS = [
  { id: "explain", label: "Explain Code", icon: Lightbulb, shortcut: "⌘⇧E" },
  { id: "bugs", label: "Find Bugs", icon: Bug, shortcut: "⌘⇧B" },
  { id: "optimize", label: "Optimize", icon: Zap },
  { id: "comments", label: "Add Comments", icon: MessageSquare },
  { id: "tests", label: "Write Tests", icon: TestTube },
];

const CODE_PROMPTS: Record<string, string> = {
  explain: "You are a senior developer. Explain the following code clearly and concisely. Break down what each section does and explain the overall purpose.",
  bugs: "Analyze this code for bugs, security issues, and potential problems. List each issue with line numbers and severity. Suggest fixes for each issue.",
  optimize: "Suggest optimizations for this code focusing on performance, readability, and best practices. Explain each optimization and its benefits.",
  comments: "Add clear, helpful inline comments to this code. Return the complete code with comments. Make comments explain the 'why', not just the 'what'.",
  convert: "Convert this code to {target_language}. Maintain functionality and use idiomatic patterns for the target language. Include any necessary imports.",
  tests: "Write comprehensive unit tests for this code using the appropriate testing framework. Include edge cases and error scenarios.",
};

interface CodeSession {
  id: string;
  code: string;
  language: string;
  timestamp: Date;
  action?: string;
}

interface CodeModeEditorProps {
  onExecute: (code: string, action: string, systemPrompt: string) => Promise<string>;
  isLoading: boolean;
  selectedModel: string;
}

export function CodeModeEditor({ onExecute, isLoading, selectedModel }: CodeModeEditorProps) {
  const [code, setCode] = useState(`# Welcome to Code Assistant
# Paste your code here and use the action buttons below

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# Example usage
for i in range(10):
    print(fibonacci(i))
`);
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [darkTheme, setDarkTheme] = useState(true);
  const [copied, setCopied] = useState(false);
  const [appliedCode, setAppliedCode] = useState(false);
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Load sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("code-sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed.map((s: CodeSession) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        })));
      } catch (e) {
        console.error("Failed to load sessions:", e);
      }
    }
  }, []);

  // Save session to history
  const saveSession = useCallback((sessionCode: string, action: string) => {
    const session: CodeSession = {
      id: crypto.randomUUID(),
      code: sessionCode,
      language,
      timestamp: new Date(),
      action,
    };
    const updated = [session, ...sessions].slice(0, 10);
    setSessions(updated);
    localStorage.setItem("code-sessions", JSON.stringify(updated));
  }, [language, sessions]);

  // Handle action execution
  const handleAction = async (actionId: string, targetLanguage?: string) => {
    if (!code.trim() || isLoading) return;

    setActiveAction(actionId);
    let systemPrompt = CODE_PROMPTS[actionId];
    
    if (actionId === "convert" && targetLanguage) {
      systemPrompt = systemPrompt.replace("{target_language}", targetLanguage);
    }

    const userPrompt = `Language: ${language}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
      saveSession(code, actionId);
      const result = await onExecute(code, userPrompt, systemPrompt);
      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : "Failed to process code"}`);
    } finally {
      setActiveAction(null);
    }
  };

  // Copy output to clipboard
  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply suggested code to editor
  const handleApply = () => {
    // Extract code blocks from output
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const matches = [...output.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      const extractedCode = matches.map(m => m[1].trim()).join("\n\n");
      setCode(extractedCode);
      setAppliedCode(true);
      setTimeout(() => setAppliedCode(false), 2000);
    }
  };

  // Load session from history
  const loadSession = (session: CodeSession) => {
    setCode(session.code);
    setLanguage(session.language);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          handleAction("explain");
        } else if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          handleAction("bugs");
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleAction("explain");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [code, language, isLoading]);

  const hasCodeBlocks = output.includes("```");

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Code Editor Panel */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-36 h-8 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="text-xs">
              {selectedModel}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* History Dropdown */}
            {sessions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                    <History className="h-4 w-4" />
                    Recent
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {sessions.map((session) => (
                    <DropdownMenuItem
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="flex flex-col items-start"
                    >
                      <span className="text-sm font-medium truncate w-full">
                        {session.code.split("\n")[0].slice(0, 40)}...
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {session.language} • {new Date(session.timestamp).toLocaleTimeString()}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDarkTheme(!darkTheme)}
            >
              {darkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(value) => setCode(value || "")}
            theme={darkTheme ? "vs-dark" : "light"}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 16 },
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 p-3 border-t border-border bg-card flex-wrap">
          <TooltipProvider>
            {CODE_ACTIONS.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeAction === action.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAction(action.id)}
                    disabled={isLoading || !code.trim()}
                    className="gap-1.5"
                  >
                    {activeAction === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <action.icon className="h-4 w-4" />
                    )}
                    {action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {action.label}
                  {action.shortcut && (
                    <span className="ml-2 text-muted-foreground">{action.shortcut}</span>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Convert Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading || !code.trim()}
                  className="gap-1.5"
                >
                  <Languages className="h-4 w-4" />
                  Convert to
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {LANGUAGES.filter((l) => l.id !== language).map((lang) => (
                  <DropdownMenuItem
                    key={lang.id}
                    onClick={() => handleAction("convert", lang.name)}
                  >
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>

          <div className="flex-1" />

          <Button
            variant="default"
            size="sm"
            onClick={() => handleAction("explain")}
            disabled={isLoading || !code.trim()}
            className="gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
            <span className="text-xs text-muted-foreground ml-1">⌘↵</span>
          </Button>
        </div>
      </div>

      {/* Output Panel */}
      <div className="flex-1 flex flex-col bg-card">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Output</h3>
          
          {output && (
            <div className="flex items-center gap-2">
              {hasCodeBlocks && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApply}
                  className="h-7 gap-1.5"
                >
                  {appliedCode ? (
                    <>
                      <Check className="h-3 w-3 text-success" />
                      Applied
                    </>
                  ) : (
                    "Apply to Editor"
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {output ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <CodeOutput content={output} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Code Assistant Ready
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Paste your code on the left and use the action buttons to analyze,
                optimize, or transform it.
              </p>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p><kbd className="px-1.5 py-0.5 rounded bg-secondary">⌘⇧E</kbd> Explain code</p>
                <p><kbd className="px-1.5 py-0.5 rounded bg-secondary">⌘⇧B</kbd> Find bugs</p>
                <p><kbd className="px-1.5 py-0.5 rounded bg-secondary">⌘↵</kbd> Run action</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component to render output with syntax highlighting for code blocks
function CodeOutput({ content }: { content: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyBlock = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Parse content and render code blocks with copy buttons
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  let blockIndex = 0;

  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        const codeBlockMatch = part.match(/```([\w]*)\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          const lang = codeBlockMatch[1] || "plaintext";
          const code = codeBlockMatch[2].trim();
          const currentIndex = blockIndex++;

          return (
            <div key={i} className="relative group">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyBlock(code, currentIndex)}
                  className="h-7 gap-1.5"
                >
                  {copiedIndex === currentIndex ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg bg-secondary/50 border border-border overflow-hidden">
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border bg-secondary/50">
                  {lang}
                </div>
                <pre className="p-4 overflow-x-auto text-sm">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          );
        }

        // Regular text
        return part.trim() ? (
          <p key={i} className="text-sm text-foreground whitespace-pre-wrap">
            {part}
          </p>
        ) : null;
      })}
    </div>
  );
}
