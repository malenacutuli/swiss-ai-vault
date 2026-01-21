import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Code, 
  Eye, 
  Database, 
  Settings, 
  FolderTree,
  Play,
  Pause,
  Square,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  RefreshCw,
  Download,
  Share2,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Brain,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExecutionStep, TerminalLine, FileNode, TaskOutput } from '@/hooks/useAgentExecutionV3';

interface ManusWorkspaceProps {
  // Task info
  taskId?: string;
  taskPrompt?: string;
  status: string;
  currentPhase?: string;
  thinking?: string;
  
  // Execution data
  steps: ExecutionStep[];
  terminalLines: TerminalLine[];
  files: FileNode[];
  outputs: TaskOutput[];
  previewUrl?: string | null;
  
  // Actions
  onCancel?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
}

/**
 * Manus-style Workspace Component
 * 
 * Features:
 * - Real-time terminal output
 * - Live preview panel with desktop/mobile toggle
 * - File browser with tree view
 * - Code editor panel
 * - Phase progress indicators
 * - Thinking/reasoning display
 */
export function ManusWorkspace({
  taskId,
  taskPrompt,
  status,
  currentPhase,
  thinking,
  steps,
  terminalLines,
  files,
  outputs,
  previewUrl,
  onCancel,
  onDownload,
  onShare,
}: ManusWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'terminal' | 'files' | 'database'>('terminal');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Status badge color
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'executing': case 'running': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'planning': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Render file tree
  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.path} style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          onClick={() => {
            if (node.type === 'directory') {
              toggleFolder(node.path);
            } else {
              setSelectedFile(node.path);
              // TODO: Fetch file content
            }
          }}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-white/5',
            selectedFile === node.path && 'bg-white/10'
          )}
        >
          {node.type === 'directory' ? (
            <>
              {expandedFolders.has(node.path) ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Folder className="w-4 h-4 text-yellow-400" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <File className="w-4 h-4 text-gray-400" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {node.type === 'directory' && expandedFolders.has(node.path) && node.children && (
          renderFileTree(node.children, depth + 1)
        )}
      </div>
    ));
  };

  return (
    <div className={cn(
      'flex flex-col bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden',
      isFullscreen ? 'fixed inset-0 z-50' : 'h-[600px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#111]">
        <div className="flex items-center gap-3">
          <Badge className={cn('text-xs', getStatusColor(status))}>
            {status === 'executing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
            {status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
            {status}
          </Badge>
          {currentPhase && (
            <span className="text-sm text-gray-400">
              Phase: {currentPhase}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {status === 'executing' && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          )}
          {onDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onShare && (
            <Button variant="ghost" size="sm" onClick={onShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Thinking/Reasoning Display */}
      <AnimatePresence>
        {thinking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20"
          >
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-purple-400 mt-0.5" />
              <p className="text-sm text-purple-200">{thinking}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Steps/Progress */}
        <div className="w-64 border-r border-white/10 bg-[#0d0d0d] overflow-y-auto">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-gray-300">Execution Steps</h3>
          </div>
          <div className="p-2 space-y-1">
            {steps.length === 0 ? (
              <p className="text-sm text-gray-500 p-2">No steps yet...</p>
            ) : (
              steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    'p-2 rounded-lg text-sm',
                    step.status === 'completed' && 'bg-green-500/10',
                    step.status === 'executing' && 'bg-blue-500/10',
                    step.status === 'failed' && 'bg-red-500/10',
                    step.status === 'pending' && 'bg-gray-500/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {step.status === 'executing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium text-gray-200">
                      {step.name || `Step ${index + 1}`}
                    </span>
                  </div>
                  {step.tool_name && (
                    <div className="mt-1 text-xs text-gray-500">
                      Tool: {step.tool_name}
                    </div>
                  )}
                  {step.description && (
                    <div className="mt-1 text-xs text-gray-400">
                      {step.description}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Tabs */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-white/10 bg-[#111] px-2">
              <TabsTrigger value="terminal" className="gap-2">
                <Terminal className="w-4 h-4" />
                Terminal
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-2">
                <Code className="w-4 h-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <FolderTree className="w-4 h-4" />
                Files
              </TabsTrigger>
              <TabsTrigger value="database" className="gap-2">
                <Database className="w-4 h-4" />
                Database
              </TabsTrigger>
            </TabsList>

            {/* Terminal Tab */}
            <TabsContent value="terminal" className="flex-1 m-0 p-0">
              <div 
                ref={terminalRef}
                className="h-full bg-black p-4 font-mono text-sm overflow-auto"
              >
                {terminalLines.length === 0 ? (
                  <div className="text-gray-500">
                    <span className="text-green-400">$</span> Waiting for execution...
                  </div>
                ) : (
                  terminalLines.map((line) => (
                    <div 
                      key={line.id}
                      className={cn(
                        'whitespace-pre-wrap',
                        line.type === 'stderr' && 'text-red-400',
                        line.type === 'system' && 'text-yellow-400',
                        line.type === 'command' && 'text-green-400',
                        line.type === 'stdout' && 'text-gray-200'
                      )}
                    >
                      {line.type === 'command' && <span className="text-green-400">$ </span>}
                      {line.content}
                    </div>
                  ))
                )}
                <div className="text-green-400 animate-pulse">█</div>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 m-0 p-0 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#111]">
                <Button
                  variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
                {previewUrl && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center bg-[#1a1a1a] p-4">
                {previewUrl ? (
                  <div className={cn(
                    'bg-white rounded-lg overflow-hidden shadow-2xl',
                    previewMode === 'desktop' ? 'w-full h-full' : 'w-[375px] h-[667px]'
                  )}>
                    <iframe
                      src={previewUrl}
                      className="w-full h-full border-0"
                      title="Preview"
                    />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No preview available yet</p>
                    <p className="text-sm">Preview will appear when the agent creates a website</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Code Tab */}
            <TabsContent value="code" className="flex-1 m-0 p-0 flex">
              <div className="w-48 border-r border-white/10 bg-[#0d0d0d] overflow-y-auto">
                {files.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4">No files yet...</p>
                ) : (
                  <div className="p-2">
                    {renderFileTree(files)}
                  </div>
                )}
              </div>
              <div className="flex-1 bg-[#1e1e1e] p-4 font-mono text-sm overflow-auto">
                {selectedFile ? (
                  <pre className="text-gray-200">{fileContent || 'Loading...'}</pre>
                ) : (
                  <div className="text-gray-500 text-center mt-8">
                    Select a file to view its contents
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="flex-1 m-0 p-4">
              {outputs.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <FolderTree className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No output files yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {outputs.map((output) => (
                    <a
                      key={output.id}
                      href={output.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <File className="w-8 h-8 text-blue-400 mb-2" />
                      <p className="font-medium text-sm truncate">{output.file_name}</p>
                      <p className="text-xs text-gray-500">{output.output_type}</p>
                    </a>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Database Tab */}
            <TabsContent value="database" className="flex-1 m-0 p-4">
              <div className="text-center text-gray-500 mt-8">
                <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Database viewer coming soon</p>
                <p className="text-sm">View and manage your application's data</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
