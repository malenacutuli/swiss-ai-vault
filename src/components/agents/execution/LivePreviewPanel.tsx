import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Editor from '@monaco-editor/react';
import type { ExecutionStep, TaskOutput } from '@/hooks/useAgentExecution';

interface LivePreviewPanelProps {
  steps: ExecutionStep[];
  outputs: TaskOutput[];
  currentStep?: ExecutionStep | null;
  onDownloadAll?: () => void;
  className?: string;
}

// File type configuration - NO EMOJIS, enterprise design
const fileTypes: Record<string, { label: string; bgColor: string }> = {
  document: { label: 'DOC', bgColor: 'bg-blue-100 text-blue-700' },
  image: { label: 'IMG', bgColor: 'bg-purple-100 text-purple-700' },
  spreadsheet: { label: 'XLS', bgColor: 'bg-green-100 text-green-700' },
  presentation: { label: 'PPT', bgColor: 'bg-orange-100 text-orange-700' },
  code: { label: 'CODE', bgColor: 'bg-gray-100 text-gray-700' },
  data: { label: 'JSON', bgColor: 'bg-yellow-100 text-yellow-700' },
  pdf: { label: 'PDF', bgColor: 'bg-red-100 text-red-700' },
  markdown: { label: 'MD', bgColor: 'bg-indigo-100 text-indigo-700' },
  default: { label: 'FILE', bgColor: 'bg-gray-100 text-gray-600' },
};

function getFileTypeKey(fileName: string, type: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet';
  if (['pptx', 'ppt'].includes(ext)) return 'presentation';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['md'].includes(ext)) return 'markdown';
  if (['docx', 'doc', 'txt'].includes(ext)) return 'document';
  if (['js', 'ts', 'py', 'html', 'css', 'json'].includes(ext)) return 'code';
  
  return type in fileTypes ? type : 'default';
}

function FileTypeBadge({ fileName, type }: { fileName: string; type: string }) {
  const key = getFileTypeKey(fileName, type);
  const config = fileTypes[key] || fileTypes.default;
  return (
    <span className={cn(
      "inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded",
      config.bgColor
    )}>
      {config.label}
    </span>
  );
}

function getMonacoLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    txt: 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
}

export function LivePreviewPanel({
  steps,
  outputs,
  currentStep,
  onDownloadAll,
  className,
}: LivePreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'terminal'>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Generate file list from outputs
  const generatedFiles = useMemo(() => {
    return outputs.map(output => ({
      name: output.file_name,
      type: output.output_type,
      size: output.file_size_bytes,
      previewUrl: output.preview_url,
      downloadUrl: output.download_url,
    }));
  }, [outputs]);
  
  // Auto-select first file
  useMemo(() => {
    if (generatedFiles.length > 0 && !selectedFile) {
      setSelectedFile(generatedFiles[0].name);
    }
  }, [generatedFiles, selectedFile]);
  
  const selectedFileData = generatedFiles.find(f => f.name === selectedFile);
  const isExecuting = steps.some(s => s.status === 'executing');
  
  return (
    <div className={cn('flex flex-col h-full bg-muted/30 rounded-xl border border-border overflow-hidden', className)}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-all duration-200',
              activeTab === 'preview' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-all duration-200',
              activeTab === 'code' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Code
          </button>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {outputs.length > 0 && onDownloadAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadAll}
              className="h-7 text-xs"
            >
              Download All
            </Button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Sidebar */}
        {generatedFiles.length > 0 && (
          <div className="w-48 border-r border-border bg-card/50 overflow-y-auto">
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Files</p>
              <div className="space-y-0.5">
                {generatedFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center gap-2 transition-all duration-150',
                      selectedFile === file.name 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <FileTypeBadge fileName={file.name} type={file.type} />
                    <span className="truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Main Preview Area */}
        <div className="flex-1 overflow-hidden">
          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="h-full flex items-center justify-center p-6">
              {isExecuting && currentStep ? (
                <div className="text-center space-y-4 animate-fade-in">
                  {/* Simple spinner - no Lucide */}
                  <div className="w-12 h-12 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Swiss Agent is working...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentStep.description || currentStep.tool_name || 'Processing'}
                    </p>
                  </div>
                </div>
              ) : selectedFileData?.previewUrl ? (
                // Show preview for selected file
                <div className="w-full h-full flex items-center justify-center">
                  {selectedFileData.type === 'image' ? (
                    <img 
                      src={selectedFileData.previewUrl} 
                      alt={selectedFileData.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  ) : (
                    <iframe
                      src={selectedFileData.previewUrl}
                      className="w-full h-full border-0 rounded-lg"
                      title={selectedFileData.name}
                    />
                  )}
                </div>
              ) : generatedFiles.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">Generated files will appear here</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">Select a file to preview</p>
                </div>
              )}
            </div>
          )}
          
          {/* Code Tab */}
          {activeTab === 'code' && selectedFile && (
            <Editor
              height="100%"
              language={getMonacoLanguage(selectedFile)}
              value={`// Preview of ${selectedFile}\n// Content would be loaded here`}
              theme="vs-light"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16 },
              }}
            />
          )}
          
          {activeTab === 'code' && !selectedFile && generatedFiles.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No code to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
