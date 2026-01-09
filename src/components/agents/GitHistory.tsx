import { useState, useEffect } from 'react';
import { GitCommit, Clock, FileText, RotateCcw, ChevronRight, Plus, Minus, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  insertions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'addition' | 'deletion' | 'header';
  content: string;
}

interface DiffResult {
  files: FileDiff[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

interface GitHistoryProps {
  taskId: string;
  onRevert?: (commitHash: string) => Promise<void>;
}

// Mock data for development
const MOCK_COMMITS: CommitInfo[] = [
  {
    hash: 'abc1234567890',
    shortHash: 'abc1234',
    message: 'Add user authentication flow',
    author: 'Swiss Agent',
    date: new Date(Date.now() - 1000 * 60 * 30),
    filesChanged: 4,
    insertions: 156,
    deletions: 23,
  },
  {
    hash: 'def5678901234',
    shortHash: 'def5678',
    message: 'Update API endpoints for data fetching',
    author: 'Swiss Agent',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    filesChanged: 2,
    insertions: 45,
    deletions: 12,
  },
  {
    hash: 'ghi9012345678',
    shortHash: 'ghi9012',
    message: 'Initial project setup with Vite and React',
    author: 'Swiss Agent',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    filesChanged: 8,
    insertions: 234,
    deletions: 0,
  },
];

const MOCK_DIFF: DiffResult = {
  files: [
    {
      path: 'src/components/Auth.tsx',
      status: 'added',
      insertions: 45,
      deletions: 0,
      hunks: [
        {
          oldStart: 0,
          newStart: 1,
          lines: [
            { type: 'addition', content: "import { useState } from 'react';" },
            { type: 'addition', content: "import { supabase } from '@/lib/supabase';" },
            { type: 'addition', content: '' },
            { type: 'addition', content: 'export function Auth() {' },
            { type: 'addition', content: '  const [email, setEmail] = useState("");' },
            { type: 'addition', content: '  const [password, setPassword] = useState("");' },
            { type: 'addition', content: '' },
            { type: 'addition', content: '  const handleLogin = async () => {' },
            { type: 'addition', content: '    await supabase.auth.signIn({ email, password });' },
            { type: 'addition', content: '  };' },
            { type: 'addition', content: '' },
            { type: 'addition', content: '  return (' },
            { type: 'addition', content: '    <form onSubmit={handleLogin}>' },
            { type: 'addition', content: '      {/* Form fields */}' },
            { type: 'addition', content: '    </form>' },
            { type: 'addition', content: '  );' },
            { type: 'addition', content: '}' },
          ],
        },
      ],
    },
    {
      path: 'src/App.tsx',
      status: 'modified',
      insertions: 8,
      deletions: 2,
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          lines: [
            { type: 'context', content: "import React from 'react';" },
            { type: 'addition', content: "import { Auth } from './components/Auth';" },
            { type: 'addition', content: "import { AuthProvider } from './context/AuthContext';" },
            { type: 'context', content: '' },
            { type: 'context', content: 'function App() {' },
            { type: 'deletion', content: '  return <div>Hello</div>;' },
            { type: 'addition', content: '  return (' },
            { type: 'addition', content: '    <AuthProvider>' },
            { type: 'addition', content: '      <Auth />' },
            { type: 'addition', content: '    </AuthProvider>' },
            { type: 'addition', content: '  );' },
            { type: 'context', content: '}' },
          ],
        },
      ],
    },
  ],
  stats: {
    filesChanged: 2,
    insertions: 53,
    deletions: 2,
  },
};

export function GitHistory({ taskId, onRevert }: GitHistoryProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCommits();
  }, [taskId]);

  const fetchCommits = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setCommits(MOCK_COMMITS);
    setIsLoading(false);
  };

  const loadDiff = async (hash: string) => {
    setIsLoading(true);
    setSelectedCommit(hash);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    setDiff(MOCK_DIFF);
    setExpandedFiles(new Set(MOCK_DIFF.files.map(f => f.path)));
    setIsLoading(false);
  };

  const handleRevert = async () => {
    if (!selectedCommit || !onRevert) return;
    setIsReverting(true);
    try {
      await onRevert(selectedCommit);
    } finally {
      setIsReverting(false);
    }
  };

  const toggleFile = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFiles(next);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const selectedCommitInfo = commits.find(c => c.hash === selectedCommit);

  return (
    <div className="flex h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Commit list sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-[#F8F9FA]">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-[#1D4E5F]" strokeWidth={1.5} />
            <h3 className="font-medium text-gray-900">Commit History</h3>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {commits.map(commit => (
              <button
                key={commit.hash}
                onClick={() => loadDiff(commit.hash)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors duration-200",
                  selectedCommit === commit.hash
                    ? "bg-[#1D4E5F]/10 border border-[#1D4E5F]/20"
                    : "bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selectedCommit === commit.hash ? "bg-[#1D4E5F]" : "bg-gray-400"
                  )} />
                  <span className="text-xs font-mono text-gray-500">
                    {commit.shortHash}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1.5">
                  {commit.message}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="h-3 w-3" strokeWidth={1.5} />
                  {formatRelativeTime(commit.date)}
                </div>
              </button>
            ))}

            {commits.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <GitCommit className="h-8 w-8 mb-2" strokeWidth={1.5} />
                <p className="text-sm">No commits yet</p>
              </div>
            )}

            {isLoading && commits.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#1D4E5F]" strokeWidth={1.5} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Diff viewer */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedCommitInfo && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#F8F9FA]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-500">
                {selectedCommitInfo.shortHash}
              </span>
              <span className="text-sm text-gray-900 font-medium">
                {selectedCommitInfo.message}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevert}
              disabled={isReverting}
              className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#1D4E5F] gap-1.5"
            >
              {isReverting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Revert to this
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {diff ? (
            <div className="p-4 space-y-4">
              {/* Stats summary */}
              <div className="flex items-center gap-4 px-3 py-2 bg-[#F8F9FA] rounded-lg border border-gray-200 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <File className="h-4 w-4" strokeWidth={1.5} />
                  <span>{diff.stats.filesChanged} files changed</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  <span>{diff.stats.insertions}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <Minus className="h-4 w-4" strokeWidth={1.5} />
                  <span>{diff.stats.deletions}</span>
                </div>
              </div>

              {/* File diffs */}
              {diff.files.map(file => (
                <div key={file.path} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFile(file.path)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[#F8F9FA] hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-gray-400 transition-transform duration-200",
                          expandedFiles.has(file.path) && "rotate-90"
                        )}
                        strokeWidth={1.5}
                      />
                      <span className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded",
                        file.status === 'added' && "bg-green-100 text-green-700",
                        file.status === 'modified' && "bg-blue-100 text-blue-700",
                        file.status === 'deleted' && "bg-red-100 text-red-700"
                      )}>
                        {file.status.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-mono text-gray-700">
                        {file.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">+{file.insertions}</span>
                      <span className="text-red-600">-{file.deletions}</span>
                    </div>
                  </button>

                  {expandedFiles.has(file.path) && (
                    <div className="border-t border-gray-200">
                      {file.hunks.map((hunk, hunkIdx) => (
                        <div key={hunkIdx} className="font-mono text-xs">
                          <div className="px-3 py-1 bg-blue-50 text-blue-600 border-b border-gray-100">
                            @@ -{hunk.oldStart} +{hunk.newStart} @@
                          </div>
                          {hunk.lines.map((line, lineIdx) => (
                            <div
                              key={lineIdx}
                              className={cn(
                                "px-3 py-0.5 whitespace-pre",
                                line.type === 'addition' && "bg-green-50 text-green-800",
                                line.type === 'deletion' && "bg-red-50 text-red-800",
                                line.type === 'context' && "text-gray-600"
                              )}
                            >
                              <span className="select-none mr-2 text-gray-400">
                                {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                              </span>
                              {line.content || ' '}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full min-h-[300px]">
              <div className="flex flex-col items-center text-gray-400">
                <FileText className="h-12 w-12 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium">Select a commit to view changes</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
