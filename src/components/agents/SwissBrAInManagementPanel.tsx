import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye,
  Code,
  FileText,
  Settings,
  Share2,
  Upload,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink,
  RefreshCw,
  Edit3,
  Maximize2,
  Copy,
  Check,
  ChevronRight,
  Database,
  Globe,
  Bell,
  Key,
  Github,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SwissBrAInManagementPanelProps {
  previewUrl?: string;
  projectFiles?: FileNode[];
  isVisible?: boolean;
  onClose?: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

export function SwissBrAInManagementPanel({
  previewUrl,
  projectFiles = [],
  isVisible = true,
  onClose,
  onPublish,
  onShare,
}: SwissBrAInManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'docs' | 'settings'>('preview');
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'domains' | 'notifications' | 'secrets' | 'github'>('general');

  const copyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const deviceWidths: Record<DeviceType, string> = {
    desktop: 'w-full',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  };

  if (!isVisible) return null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-[#E5E5E5]">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-1">
          {/* Tab Buttons */}
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === 'preview'
                ? "bg-[#F5F5F5] text-[#1A1A1A]"
                : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA]"
            )}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === 'code'
                ? "bg-[#F5F5F5] text-[#1A1A1A]"
                : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA]"
            )}
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === 'docs'
                ? "bg-[#F5F5F5] text-[#1A1A1A]"
                : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA]"
            )}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === 'settings'
                ? "bg-[#F5F5F5] text-[#1A1A1A]"
                : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA]"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-[#E5E5E5] mx-2" />
          
          {/* More options */}
          <button className="p-1.5 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA] rounded-md">
            <span className="text-lg">···</span>
          </button>
          <button className="p-1.5 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA] rounded-md">
            <Github className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="text-[#666666] hover:text-[#1A1A1A]"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Share
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            className="bg-[#D35400] hover:bg-[#B84700] text-white"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Publish
          </Button>
        </div>
      </div>

      {/* Preview Controls (only shown in preview tab) */}
      {activeTab === 'preview' && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-1">
            {/* Device toggles */}
            <button
              onClick={() => setDeviceType('desktop')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                deviceType === 'desktop'
                  ? "bg-white text-[#1A1A1A] shadow-sm"
                  : "text-[#666666] hover:text-[#1A1A1A]"
              )}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceType('tablet')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                deviceType === 'tablet'
                  ? "bg-white text-[#1A1A1A] shadow-sm"
                  : "text-[#666666] hover:text-[#1A1A1A]"
              )}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceType('mobile')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                deviceType === 'mobile'
                  ? "bg-white text-[#1A1A1A] shadow-sm"
                  : "text-[#666666] hover:text-[#1A1A1A]"
              )}
            >
              <Smartphone className="w-4 h-4" />
            </button>
            
            <div className="w-px h-5 bg-[#E5E5E5] mx-2" />
            
            {/* URL bar */}
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-md border border-[#E5E5E5]">
              <Globe className="w-3.5 h-3.5 text-[#999999]" />
              <span className="text-xs text-[#666666] max-w-[200px] truncate">
                {previewUrl || 'No preview available'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.open(previewUrl, '_blank')}
              className="p-1.5 text-[#666666] hover:text-[#1A1A1A] hover:bg-white rounded-md"
              disabled={!previewUrl}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#666666] hover:text-[#1A1A1A] hover:bg-white rounded-md">
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <div className="w-px h-5 bg-[#E5E5E5] mx-2" />
            
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors",
                isEditMode
                  ? "bg-[#D35400] text-white"
                  : "text-[#666666] hover:text-[#1A1A1A] hover:bg-white"
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button className="p-1.5 text-[#666666] hover:text-[#1A1A1A] hover:bg-white rounded-md">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="h-full flex items-start justify-center p-4 bg-[#F5F5F5] overflow-auto">
            <div className={cn(
              "bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
              deviceWidths[deviceType],
              deviceType !== 'desktop' && "mx-auto"
            )}>
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[600px] border-none"
                  title="Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[600px] text-[#999999]">
                  <Monitor className="w-12 h-12 mb-4 opacity-50" />
                  <p>No preview available</p>
                  <p className="text-sm mt-1">Start a task to see the preview</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="h-full flex">
            {/* File Tree */}
            <div className="w-64 border-r border-[#E5E5E5] overflow-y-auto">
              <div className="p-3 border-b border-[#E5E5E5]">
                <h3 className="text-sm font-medium text-[#1A1A1A]">Files</h3>
              </div>
              <div className="p-2">
                {projectFiles.length === 0 ? (
                  <p className="text-sm text-[#999999] p-2">No files yet</p>
                ) : (
                  <FileTree files={projectFiles} />
                )}
              </div>
            </div>
            
            {/* Code Editor Placeholder */}
            <div className="flex-1 flex items-center justify-center bg-[#1E1E1E] text-[#999999]">
              <div className="text-center">
                <Code className="w-12 h-12 mb-4 mx-auto opacity-50" />
                <p>Select a file to view</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">Documentation</h2>
              <p className="text-[#666666]">
                Documentation for your project will appear here once generated.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full flex">
            {/* Settings Sidebar */}
            <div className="w-48 border-r border-[#E5E5E5] p-2">
              <nav className="space-y-1">
                {[
                  { id: 'general', label: 'General', icon: Settings },
                  { id: 'domains', label: 'Domains', icon: Globe },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'secrets', label: 'Secrets', icon: Key },
                  { id: 'github', label: 'GitHub', icon: Github },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSettingsTab(item.id as any)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      settingsTab === item.id
                        ? "bg-[#F5F5F5] text-[#1A1A1A]"
                        : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#FAFAFA]"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Settings Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-xl">
                {settingsTab === 'general' && (
                  <div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-4">General Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#666666] mb-1">
                          Website Name
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D35400]/20 focus:border-[#D35400]"
                          placeholder="My SwissBrAIn Project"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#666666] mb-1">
                          Visibility
                        </label>
                        <select className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D35400]/20 focus:border-[#D35400]">
                          <option>Public</option>
                          <option>Private</option>
                          <option>Unlisted</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'domains' && (
                  <div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-4">Custom Domains</h3>
                    <p className="text-sm text-[#666666] mb-4">
                      Connect your own domain or use a SwissBrAIn subdomain.
                    </p>
                    <Button className="bg-[#D35400] hover:bg-[#B84700]">
                      Add Domain
                    </Button>
                  </div>
                )}
                
                {settingsTab === 'notifications' && (
                  <div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-4">Notifications</h3>
                    <p className="text-sm text-[#666666]">
                      Configure notification settings for your project.
                    </p>
                  </div>
                )}
                
                {settingsTab === 'secrets' && (
                  <div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-4">Environment Variables</h3>
                    <p className="text-sm text-[#666666] mb-4">
                      Manage secrets and environment variables for your project.
                    </p>
                    <Button variant="outline">
                      Add Secret
                    </Button>
                  </div>
                )}
                
                {settingsTab === 'github' && (
                  <div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-4">GitHub Export</h3>
                    <p className="text-sm text-[#666666] mb-4">
                      Export your project code to a GitHub repository.
                    </p>
                    <Button className="bg-[#1A1A1A] hover:bg-[#333333]">
                      <Github className="w-4 h-4 mr-2" />
                      Connect GitHub
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Made with SwissBrAIn badge */}
      <div className="absolute bottom-4 right-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-lg border border-[#E5E5E5] text-xs text-[#666666]">
          <span>🧠</span>
          <span>Made with SwissBrAIn</span>
          <button className="ml-1 text-[#999999] hover:text-[#666666]">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// File Tree Component
function FileTree({ files, depth = 0 }: { files: FileNode[]; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleFolder = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-0.5">
      {files.map((file) => (
        <div key={file.name}>
          <button
            onClick={() => file.type === 'folder' && toggleFolder(file.name)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-[#F5F5F5] transition-colors",
              "text-[#666666] hover:text-[#1A1A1A]"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {file.type === 'folder' ? (
              <>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expanded[file.name] && "rotate-90"
                  )}
                />
                <span>📁</span>
              </>
            ) : (
              <>
                <span className="w-3" />
                <span>📄</span>
              </>
            )}
            <span className="truncate">{file.name}</span>
          </button>
          
          {file.type === 'folder' && expanded[file.name] && file.children && (
            <FileTree files={file.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
