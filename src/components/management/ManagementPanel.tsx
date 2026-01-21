/**
 * ManagementPanel - Manus.im Parity Management UI
 * 
 * This component replicates the right-side management panel from Manus.im
 * including Preview, Code, Dashboard, Database, and Settings tabs.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Code, 
  LayoutDashboard, 
  Database, 
  Settings, 
  Share2, 
  Upload, 
  Download,
  ExternalLink,
  RefreshCw,
  Edit3,
  Maximize2,
  Home,
  ChevronRight,
  FolderTree,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  History,
  MoreHorizontal,
  X,
  Check,
  Copy,
  Eye,
  Globe,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Search,
  Filter,
  SortAsc,
  Clock,
  Users,
  Activity,
  BarChart3,
  PieChart,
  TrendingUp,
  Zap,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Terminal,
  Play,
  Pause,
  Square,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Types
interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  size?: number;
  modified?: string;
}

interface Checkpoint {
  id: string;
  version: string;
  description: string;
  timestamp: string;
  author: string;
}

interface ManagementPanelProps {
  projectId?: string;
  projectName?: string;
  previewUrl?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

// Preview Panel Component
const PreviewPanel: React.FC<{
  previewUrl?: string;
  projectName?: string;
}> = ({ previewUrl, projectName }) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        {/* Device Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('desktop')}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('mobile')}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        {/* URL Bar */}
        <div className="flex items-center gap-2 flex-1 mx-4">
          <Button variant="ghost" size="sm" className="h-7 px-2">
            <Home className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>/</span>
            <Input
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              className="h-6 w-32 text-xs bg-transparent border-none p-0"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleOpenExternal}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant={isEditMode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Edit3 className="h-4 w-4" />
            <span className="text-xs">Edit</span>
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center p-4">
        <div 
          className={cn(
            "bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300",
            viewMode === 'desktop' ? "w-full h-full" : "w-[375px] h-[667px]"
          )}
        >
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full border-0"
              title="Preview"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <Monitor className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">No preview available</p>
              <p className="text-xs mt-1">Start a task to see the preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {viewMode === 'desktop' ? '1920×1080' : '375×667'}
          </Badge>
          {isEditMode && (
            <Badge variant="secondary" className="text-xs">
              Edit Mode
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Powered by SwissBrain</span>
        </div>
      </div>
    </div>
  );
};

// Code Panel Component
const CodePanel: React.FC<{
  projectId?: string;
}> = ({ projectId }) => {
  const [files, setFiles] = useState<FileNode[]>([
    {
      name: 'src',
      type: 'folder',
      path: '/src',
      children: [
        { name: 'App.tsx', type: 'file', path: '/src/App.tsx', size: 2048 },
        { name: 'main.tsx', type: 'file', path: '/src/main.tsx', size: 512 },
        { name: 'index.css', type: 'file', path: '/src/index.css', size: 1024 },
        {
          name: 'components',
          type: 'folder',
          path: '/src/components',
          children: [
            { name: 'Button.tsx', type: 'file', path: '/src/components/Button.tsx', size: 768 },
            { name: 'Card.tsx', type: 'file', path: '/src/components/Card.tsx', size: 1024 },
          ]
        },
        {
          name: 'pages',
          type: 'folder',
          path: '/src/pages',
          children: [
            { name: 'Home.tsx', type: 'file', path: '/src/pages/Home.tsx', size: 2048 },
            { name: 'About.tsx', type: 'file', path: '/src/pages/About.tsx', size: 1536 },
          ]
        }
      ]
    },
    { name: 'package.json', type: 'file', path: '/package.json', size: 1024 },
    { name: 'vite.config.ts', type: 'file', path: '/vite.config.ts', size: 512 },
    { name: 'tsconfig.json', type: 'file', path: '/tsconfig.json', size: 768 },
    { name: 'README.md', type: 'file', path: '/README.md', size: 2048 },
  ]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/src']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'folder') {
      return expandedFolders.has(name) ? FolderOpen : Folder;
    }
    if (name.endsWith('.tsx') || name.endsWith('.ts')) return FileCode;
    if (name.endsWith('.json')) return FileJson;
    if (name.endsWith('.md')) return FileText;
    return File;
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const Icon = getFileIcon(node.path, node.type);
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;

      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-sm text-sm",
              isSelected && "bg-muted"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(node.path);
              } else {
                setSelectedFile(node.path);
              }
            }}
          >
            {node.type === 'folder' && (
              <ChevronRight 
                className={cn(
                  "h-3 w-3 transition-transform",
                  isExpanded && "rotate-90"
                )} 
              />
            )}
            <Icon className={cn(
              "h-4 w-4",
              node.type === 'folder' ? "text-yellow-500" : "text-blue-500"
            )} />
            <span className="truncate">{node.name}</span>
            {node.size && (
              <span className="text-xs text-muted-foreground ml-auto">
                {(node.size / 1024).toFixed(1)}KB
              </span>
            )}
          </div>
          {node.type === 'folder' && isExpanded && node.children && (
            renderFileTree(node.children, depth + 1)
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4" />
          <span className="text-sm font-medium">Files</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {renderFileTree(files)}
        </div>
      </ScrollArea>

      {/* Code Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
        <span className="text-xs text-muted-foreground">
          {files.length} items
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
          <Download className="h-3 w-3" />
          Download All
        </Button>
      </div>
    </div>
  );
};

// Dashboard Panel Component
const DashboardPanel: React.FC<{
  projectId?: string;
}> = ({ projectId }) => {
  const stats = {
    visitors: 1234,
    pageViews: 5678,
    avgDuration: '2m 34s',
    bounceRate: '42%',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </div>
        <Badge variant="outline" className="text-xs">Last 7 days</Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Visitors</span>
              </div>
              <p className="text-2xl font-bold">{stats.visitors.toLocaleString()}</p>
              <p className="text-xs text-green-500">+12% from last week</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-xs">Page Views</span>
              </div>
              <p className="text-2xl font-bold">{stats.pageViews.toLocaleString()}</p>
              <p className="text-xs text-green-500">+8% from last week</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Avg Duration</span>
              </div>
              <p className="text-2xl font-bold">{stats.avgDuration}</p>
              <p className="text-xs text-muted-foreground">Per session</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Bounce Rate</span>
              </div>
              <p className="text-2xl font-bold">{stats.bounceRate}</p>
              <p className="text-xs text-red-500">+2% from last week</p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">System Status</span>
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                All Systems Operational
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span>API Server</span>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span>Database</span>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>Storage</span>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-muted/50 rounded-lg p-3">
            <span className="text-sm font-medium">Recent Activity</span>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <Activity className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <p>Deployment completed</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-purple-500 mt-0.5" />
                <div>
                  <p>New checkpoint created</p>
                  <p className="text-xs text-muted-foreground">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p>Build optimized</p>
                  <p className="text-xs text-muted-foreground">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// Database Panel Component
const DatabasePanel: React.FC<{
  projectId?: string;
}> = ({ projectId }) => {
  const tables = [
    { name: 'users', rows: 1234, size: '2.4 MB' },
    { name: 'posts', rows: 5678, size: '12.8 MB' },
    { name: 'comments', rows: 9012, size: '8.2 MB' },
    { name: 'sessions', rows: 456, size: '0.8 MB' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Database Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <span className="text-sm font-medium">Database</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
          <Terminal className="h-4 w-4" />
          <span className="text-xs">SQL</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Connection Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Connection</span>
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                Connected
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Host: db.swissbrain.ai</p>
              <p>Database: swissbrain_prod</p>
              <p>SSL: Enabled</p>
            </div>
          </div>

          {/* Tables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Tables</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                New Table
              </Button>
            </div>
            <div className="space-y-2">
              {tables.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{table.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{table.rows.toLocaleString()} rows</span>
                    <span>{table.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// Settings Panel Component
const SettingsPanel: React.FC<{
  projectId?: string;
  projectName?: string;
}> = ({ projectId, projectName }) => {
  const [activeSection, setActiveSection] = useState('general');

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'domains', label: 'Domains', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Activity },
    { id: 'secrets', label: 'Secrets', icon: Lock },
    { id: 'github', label: 'GitHub', icon: GitBranch },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Settings Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium">Settings</span>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Settings Sidebar */}
        <div className="w-40 border-r">
          <div className="py-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50",
                    activeSection === section.id && "bg-muted"
                  )}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeSection === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Project Name</label>
                  <Input defaultValue={projectName || 'My Project'} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Visibility</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Lock className="h-4 w-4" />
                      Private
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <Globe className="h-4 w-4" />
                      Public
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Favicon</label>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Button variant="outline" size="sm">Upload</Button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'domains' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Auto-generated Domain</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input defaultValue="myproject.swissbrain.space" className="flex-1" />
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium">Custom Domain</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input placeholder="example.com" className="flex-1" />
                    <Button size="sm">Add</Button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'secrets' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Environment Variables</span>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Secret
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">DATABASE_URL</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">API_KEY</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'github' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">GitHub Export</span>
                  <Badge variant="outline">Not connected</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Export your project code to a GitHub repository.
                </p>
                <Button className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Connect GitHub
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

// Main Management Panel Component
export const ManagementPanel: React.FC<ManagementPanelProps> = ({
  projectId,
  projectName,
  previewUrl,
  isCollapsed = false,
  onToggleCollapse,
  onPublish,
  onShare,
}) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([
    {
      id: '1',
      version: 'v1.0.0',
      description: 'Initial commit',
      timestamp: '2024-01-21T10:00:00Z',
      author: 'User',
    },
  ]);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const handleDownload = () => {
    toast.success('Downloading project as ZIP...');
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handlePublish = () => {
    setShowPublishDialog(true);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full border-l bg-background flex flex-col items-center py-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Expand panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="w-[480px] h-full border-l bg-background flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30">
        {/* Tab Buttons */}
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTab === 'preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab('preview')}
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">Preview</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTab === 'code' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setActiveTab('code')}
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Code</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setActiveTab('dashboard')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dashboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTab === 'database' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setActiveTab('database')}
                >
                  <Database className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Database</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setActiveTab('history')}>
                <History className="h-4 w-4 mr-2" />
                Version History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download ZIP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setActiveTab('settings')}>
            <Settings className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" className="h-8 px-3 gap-1.5" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            <span className="text-xs">Share</span>
          </Button>

          <Button size="sm" className="h-8 px-3 gap-1.5" onClick={handlePublish}>
            <Upload className="h-4 w-4" />
            <span className="text-xs">Publish</span>
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <PreviewPanel previewUrl={previewUrl} projectName={projectName} />
        )}
        {activeTab === 'code' && (
          <CodePanel projectId={projectId} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardPanel projectId={projectId} />
        )}
        {activeTab === 'database' && (
          <DatabasePanel projectId={projectId} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel projectId={projectId} projectName={projectName} />
        )}
        {activeTab === 'history' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="text-sm font-medium">Version History</span>
              </div>
              <Button size="sm" className="h-7 gap-1">
                <Plus className="h-3 w-3" />
                Checkpoint
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {checkpoints.map((checkpoint) => (
                  <div
                    key={checkpoint.id}
                    className="p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{checkpoint.version}</span>
                      <Badge variant="outline" className="text-xs">Latest</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{checkpoint.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(checkpoint.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Project</DialogTitle>
            <DialogDescription>
              Share your project with others via link or invite collaborators.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Share Link</label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={`https://swissbrain.space/${projectId}`} readOnly />
                <Button variant="outline" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(`https://swissbrain.space/${projectId}`);
              toast.success('Link copied to clipboard!');
              setShowShareDialog(false);
            }}>
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Project</DialogTitle>
            <DialogDescription>
              Deploy your project to make it publicly accessible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">Ready to publish</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your project will be deployed to: {projectName}.swissbrain.space
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success('Publishing project...');
              setShowPublishDialog(false);
              onPublish?.();
            }}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagementPanel;
