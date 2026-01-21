/**
 * AgentWorkspace - Manus.im Parity Full Workspace
 * 
 * This page replicates the complete Manus.im agent workspace with:
 * - Left: Chat panel with progress indicators
 * - Right: Management UI (Preview, Code, Dashboard, Database, Settings)
 * - Real-time streaming of agent execution
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  Code,
  LayoutDashboard,
  Database,
  Settings,
  Share2,
  Upload,
  Download,
  History,
  FileText,
  Github,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  ExternalLink,
  Edit3,
  Maximize2,
  FolderTree,
  File,
  Folder,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  AlertCircle,
  PanelRightClose,
  PanelRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Import our custom components
import { AgentChatPanel } from '@/components/agent/AgentChatPanel';
import { ComputerPanel } from '@/components/agent/ComputerPanel';
import { ManagementPanel } from '@/components/management/ManagementPanel';

// Types
interface Task {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: any[];
  knowledge?: any[];
  phase?: { current: number; total: number; name: string };
  elapsedTime?: string;
  status?: 'thinking' | 'executing' | 'completed' | 'failed';
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  content: string;
  timestamp: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// Mock data for demonstration
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Design a pitch deck for a startup seeking funding',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    role: 'assistant',
    content: 'I\'ll help you create a professional pitch deck. Let me start by setting up the project and gathering the necessary information.',
    timestamp: new Date().toISOString(),
    phase: { current: 1, total: 6, name: 'Initializing project' },
    status: 'thinking',
    actions: [
      { id: '1', type: 'thinking', description: 'Analyzing requirements', status: 'completed', timestamp: '' },
      { id: '2', type: 'writing', description: 'Creating project structure', file: 'pitch-deck/', status: 'in_progress', timestamp: '' },
    ],
    knowledge: [
      { id: '1', title: 'Pitch Deck Best Practices', source: 'internal' },
      { id: '2', title: 'Startup Funding Guidelines', source: 'web' },
    ],
  },
];

const mockTerminalLines: TerminalLine[] = [
  { id: '1', type: 'info', content: 'Starting SwissVault sandbox...', timestamp: '' },
  { id: '2', type: 'success', content: 'Sandbox initialized successfully', timestamp: '' },
  { id: '3', type: 'input', content: 'mkdir -p pitch-deck && cd pitch-deck', timestamp: '' },
  { id: '4', type: 'output', content: '', timestamp: '' },
  { id: '5', type: 'input', content: 'npm init -y', timestamp: '' },
  { id: '6', type: 'output', content: 'Wrote to /home/user/pitch-deck/package.json', timestamp: '' },
];

const mockFiles: FileNode[] = [
  {
    name: 'pitch-deck',
    path: '/pitch-deck',
    type: 'directory',
    children: [
      { name: 'package.json', path: '/pitch-deck/package.json', type: 'file' },
      { name: 'src', path: '/pitch-deck/src', type: 'directory', children: [
        { name: 'index.tsx', path: '/pitch-deck/src/index.tsx', type: 'file' },
        { name: 'App.tsx', path: '/pitch-deck/src/App.tsx', type: 'file' },
      ]},
      { name: 'public', path: '/pitch-deck/public', type: 'directory', children: [
        { name: 'index.html', path: '/pitch-deck/public/index.html', type: 'file' },
      ]},
    ],
  },
];

// File Tree Component
const FileTree: React.FC<{
  files: FileNode[];
  selectedFile?: string;
  onSelectFile: (path: string) => void;
}> = ({ files, selectedFile, onSelectFile }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['/pitch-deck']));

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-muted rounded-md transition-colors",
            isSelected && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node.path);
            } else {
              onSelectFile(node.path);
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
              <Folder className="h-4 w-4 text-blue-500" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <File className="h-4 w-4 text-muted-foreground" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2">
      {files.map(file => renderNode(file))}
    </div>
  );
};

// Code Panel Component
const CodePanel: React.FC<{
  files: FileNode[];
  selectedFile?: string;
  fileContent?: string;
  onSelectFile: (path: string) => void;
}> = ({ files, selectedFile, fileContent, onSelectFile }) => {
  return (
    <div className="h-full flex">
      {/* File Tree */}
      <div className="w-64 border-r overflow-auto">
        <div className="p-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Files</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <FileTree files={files} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span className="text-sm">{selectedFile}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-sm font-mono">
                <code>{fileContent || '// Select a file to view its contents'}</code>
              </pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Code className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Select a file to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard Panel Component
const DashboardPanel: React.FC = () => {
  return (
    <div className="h-full p-6">
      <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold">12</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold">3</div>
          <div className="text-sm text-muted-foreground">Running</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold">9</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="flex-1">
                <div className="text-sm">Task completed</div>
                <div className="text-xs text-muted-foreground">2 hours ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Database Panel Component
const DatabasePanel: React.FC = () => {
  return (
    <div className="h-full p-6">
      <h2 className="text-lg font-semibold mb-4">Database</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Table</th>
              <th className="text-left p-3">Rows</th>
              <th className="text-left p-3">Size</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">users</td>
              <td className="p-3">1,234</td>
              <td className="p-3">2.4 MB</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">tasks</td>
              <td className="p-3">5,678</td>
              <td className="p-3">12.1 MB</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">files</td>
              <td className="p-3">890</td>
              <td className="p-3">45.6 MB</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Settings Panel Component
const SettingsPanel: React.FC = () => {
  return (
    <div className="h-full p-6">
      <h2 className="text-lg font-semibold mb-4">Settings</h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">General</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm">Project Name</div>
                <div className="text-xs text-muted-foreground">pitch-deck</div>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm">Visibility</div>
                <div className="text-xs text-muted-foreground">Private</div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Domains</h3>
          <div className="p-3 border rounded-lg">
            <div className="text-sm">pitch-deck.swissbrain.app</div>
            <div className="text-xs text-muted-foreground mt-1">Custom domain available on Pro plan</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Agent Workspace Component
export const AgentWorkspace: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(mockTerminalLines);
  const [isExecuting, setIsExecuting] = useState(true);
  const [currentPhase, setCurrentPhase] = useState({ current: 2, total: 6, name: 'Setting up project' });
  const [elapsedTime, setElapsedTime] = useState('1:52');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [activePanel, setActivePanel] = useState<'preview' | 'code' | 'dashboard' | 'database' | 'settings'>('preview');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isManagementOpen, setIsManagementOpen] = useState(true);
  const [files, setFiles] = useState<FileNode[]>(mockFiles);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update elapsed time
      setElapsedTime(prev => {
        const [mins, secs] = prev.split(':').map(Number);
        const totalSecs = mins * 60 + secs + 1;
        return `${Math.floor(totalSecs / 60)}:${String(totalSecs % 60).padStart(2, '0')}`;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulate SSE connection for real-time updates
  useEffect(() => {
    if (!taskId) return;

    // In production, this would connect to the SSE endpoint
    // const eventSource = new EventSource(`/api/agent/stream/${taskId}`);
    
    // Simulate receiving updates
    const timeout = setTimeout(() => {
      setTerminalLines(prev => [
        ...prev,
        { id: String(Date.now()), type: 'input', content: 'npm install react react-dom', timestamp: '' },
        { id: String(Date.now() + 1), type: 'output', content: 'added 2 packages in 1.2s', timestamp: '' },
      ]);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [taskId]);

  // Handlers
  const handleSendMessage = useCallback((message: string, attachments?: File[]) => {
    const newMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);

    // Simulate assistant response
    setTimeout(() => {
      const response: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: 'I understand. Let me work on that for you.',
        timestamp: new Date().toISOString(),
        status: 'thinking',
      };
      setMessages(prev => [...prev, response]);
    }, 1000);
  }, []);

  const handlePause = useCallback(() => {
    setIsExecuting(false);
    toast.info('Task paused');
  }, []);

  const handleResume = useCallback(() => {
    setIsExecuting(true);
    toast.info('Task resumed');
  }, []);

  const handleStop = useCallback(() => {
    setIsExecuting(false);
    toast.warning('Task stopped');
  }, []);

  const handlePublish = useCallback(() => {
    toast.success('Publishing project...');
  }, []);

  const handleShare = useCallback(() => {
    toast.success('Share link copied to clipboard');
  }, []);

  const handleDownload = useCallback(() => {
    toast.success('Preparing download...');
  }, []);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
    // In production, fetch file content from API
    setFileContent(`// Content of ${path}\n\nexport default function App() {\n  return <div>Hello World</div>;\n}`);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        {/* Left: Navigation */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isExecuting ? "bg-green-500 animate-pulse" : "bg-gray-400"
              )} />
              {isExecuting ? 'Running' : 'Idle'}
            </Badge>
            <span className="text-sm text-muted-foreground">{elapsedTime}</span>
          </div>
        </div>

        {/* Center: Panel Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activePanel === 'preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActivePanel('preview')}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </TooltipTrigger>
              <TooltipContent>Live preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activePanel === 'code' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActivePanel('code')}
                >
                  <Code className="h-4 w-4" />
                  Code
                </Button>
              </TooltipTrigger>
              <TooltipContent>View code</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activePanel === 'dashboard' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActivePanel('dashboard')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </TooltipTrigger>
              <TooltipContent>Analytics dashboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activePanel === 'database' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActivePanel('database')}
                >
                  <Database className="h-4 w-4" />
                  Database
                </Button>
              </TooltipTrigger>
              <TooltipContent>Database viewer</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activePanel === 'settings' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActivePanel('settings')}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </TooltipTrigger>
              <TooltipContent>Project settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Version history</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View docs</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Github className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>GitHub</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePublish}>
            <Upload className="h-4 w-4" />
            Publish
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate project
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export as ZIP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel: Chat */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <AgentChatPanel
              taskId={taskId}
              taskTitle="Design a pitch deck"
              messages={messages}
              isExecuting={isExecuting}
              currentPhase={currentPhase}
              elapsedTime={elapsedTime}
              onSendMessage={handleSendMessage}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Management UI */}
          <ResizablePanel defaultSize={65}>
            <div className="h-full flex flex-col">
              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {activePanel === 'preview' && (
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50}>
                      <ComputerPanel
                        taskId={taskId}
                        terminalLines={terminalLines}
                        previewUrl={previewUrl}
                        isExecuting={isExecuting}
                        onRefresh={() => {}}
                        onOpenExternal={() => previewUrl && window.open(previewUrl, '_blank')}
                        onDeviceChange={setDevice}
                      />
                    </ResizablePanel>
                    {isManagementOpen && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50}>
                          <ManagementPanel
                            projectId={taskId}
                            previewUrl={previewUrl}
                            onClose={() => setIsManagementOpen(false)}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                )}
                {activePanel === 'code' && (
                  <CodePanel
                    files={files}
                    selectedFile={selectedFile}
                    fileContent={fileContent}
                    onSelectFile={handleSelectFile}
                  />
                )}
                {activePanel === 'dashboard' && <DashboardPanel />}
                {activePanel === 'database' && <DatabasePanel />}
                {activePanel === 'settings' && <SettingsPanel />}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default AgentWorkspace;
