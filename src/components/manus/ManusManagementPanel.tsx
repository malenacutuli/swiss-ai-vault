import { useState } from 'react';
import { 
  X, 
  Eye, 
  Code, 
  FileText, 
  Settings, 
  Github,
  RefreshCw,
  ExternalLink,
  Home,
  Monitor,
  Tablet,
  Smartphone,
  ChevronRight,
  File,
  Folder,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ProjectFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: ProjectFile[];
}

interface ManusManagementPanelProps {
  previewUrl?: string;
  projectFiles?: ProjectFile[];
  isVisible: boolean;
  onClose: () => void;
  taskId?: string;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function ManusManagementPanel({
  previewUrl,
  projectFiles = [],
  isVisible,
  onClose,
  taskId,
}: ManusManagementPanelProps) {
  const [activeTab, setActiveTab] = useState('preview');
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileSelect = async (file: ProjectFile) => {
    if (file.type === 'folder') {
      toggleFolder(file.path);
    } else {
      setSelectedFile(file.path);
      // TODO: Fetch file content from backend
      setFileContent(`// Content of ${file.name}\n// Loading...`);
    }
  };

  const renderFileTree = (files: ProjectFile[], depth = 0) => {
    return files.map((file) => (
      <div key={file.path}>
        <button
          onClick={() => handleFileSelect(file)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-left text-sm",
            selectedFile === file.path && "bg-gray-100"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {file.type === 'folder' ? (
            <>
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-gray-400 transition-transform",
                  expandedFolders.has(file.path) && "rotate-90"
                )}
              />
              <Folder className="w-4 h-4 text-amber-500" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <File className="w-4 h-4 text-gray-400" />
            </>
          )}
          <span className="truncate">{file.name}</span>
        </button>
        {file.type === 'folder' && expandedFolders.has(file.path) && file.children && (
          renderFileTree(file.children, depth + 1)
        )}
      </div>
    ));
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="preview" className="gap-2 data-[state=active]:bg-white">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2 data-[state=active]:bg-white">
              <Code className="w-4 h-4" />
              Code
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2 data-[state=active]:bg-white">
              <FileText className="w-4 h-4" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-white">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-2 data-[state=active]:bg-white">
              <Github className="w-4 h-4" />
              GitHub
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={onClose} className="ml-2">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="flex flex-col h-full">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E5] bg-gray-50">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Home className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                {previewUrl && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 max-w-[300px]">
                    <span className="truncate">{previewUrl}</span>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
                <Button
                  variant={deviceType === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDeviceType('desktop')}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceType === 'tablet' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDeviceType('tablet')}
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceType === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDeviceType('mobile')}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
              {previewUrl ? (
                <div
                  className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
                  style={{
                    width: deviceWidths[deviceType],
                    maxWidth: '100%',
                    height: deviceType === 'mobile' ? '667px' : '100%',
                  }}
                >
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Preview"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No preview available</p>
                  <p className="text-sm mt-1">Preview will appear when the task generates a website or app</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="flex h-full">
            {/* File Tree */}
            <div className="w-64 border-r border-[#E5E5E5] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E5] bg-gray-50">
                <span className="text-sm font-medium">Files</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {projectFiles.length > 0 ? (
                  renderFileTree(projectFiles)
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No files yet
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-hidden">
              {selectedFile ? (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2 border-b border-[#E5E5E5] bg-gray-50">
                    <span className="text-sm text-gray-600">{selectedFile}</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <pre className="p-4 text-sm font-mono text-gray-800">
                      {fileContent}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Code className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Select a file to view its content</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Documentation</p>
              <p className="text-sm mt-1">Generated documentation will appear here</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-4">Task Settings</h3>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Task ID</h4>
                <p className="text-sm text-gray-500 font-mono">{taskId || 'N/A'}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Environment</h4>
                <p className="text-sm text-gray-500">E2B Sandbox</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'github' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Github className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>GitHub Integration</p>
              <p className="text-sm mt-1">Connect to push code to your repository</p>
              <Button variant="outline" className="mt-4">
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManusManagementPanel;
