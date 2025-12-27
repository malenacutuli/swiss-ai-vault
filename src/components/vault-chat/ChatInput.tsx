import { useState, useRef, useCallback } from 'react';
import { Plus, Send, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelProviderBar } from './ModelProviderBar';
import { RetentionModeDropdown, type RetentionMode } from './RetentionModeDropdown';
import { ConnectedSourcesBar } from './ConnectedSourcesBar';
import { FileAttachment, type AttachedFile } from './FileAttachment';
import { cn } from '@/lib/utils';

export interface ChatContext {
  model: string;
  retentionMode: RetentionMode;
  mentions: Array<{ id: string; type: string; name: string }>;
  files: Array<{ id: string; name: string }>;
}

interface UploadedDocument {
  filename: string;
  chunkCount: number;
  uploadedAt: Date;
}

interface ChatInputProps {
  onSend: (message: string, context: ChatContext) => Promise<void>;
  disabled?: boolean;
  isEncrypting?: boolean;
  isSending?: boolean;
  integrations: Array<{ type: string; isConnected: boolean; isActive: boolean }>;
  documents: UploadedDocument[];
  onFileUpload: (files: FileList) => void;
  onToggleIntegration: (type: string) => void;
  onConnectIntegration: (type: string) => void;
  retentionMode?: RetentionMode;
  onRetentionModeChange?: (mode: RetentionMode) => void;
}

export function ChatInput({
  onSend,
  disabled,
  isEncrypting,
  isSending,
  integrations,
  documents,
  onFileUpload,
  onToggleIntegration,
  onConnectIntegration,
  retentionMode: externalRetentionMode,
  onRetentionModeChange,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [internalRetentionMode, setInternalRetentionMode] = useState<RetentionMode>('zerotrace');
  const [mentions, setMentions] = useState<Array<{ id: string; type: string; name: string }>>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  
  // Use external retention mode if provided, otherwise use internal state
  const retentionMode = externalRetentionMode ?? internalRetentionMode;
  
  const handleRetentionChange = (mode: RetentionMode) => {
    setInternalRetentionMode(mode);
    onRetentionModeChange?.(mode);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleSend = useCallback(async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    
    await onSend(message, {
      model: selectedModel,
      retentionMode,
      mentions,
      files: attachedFiles.map(f => ({ id: f.id, name: f.name }))
    });
    
    setMessage('');
    setMentions([]);
    setAttachedFiles([]);
  }, [message, selectedModel, retentionMode, mentions, attachedFiles, onSend]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AttachedFile[] = Array.from(e.target.files).map(f => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type,
        status: 'encrypting' as const
      }));
      
      setAttachedFiles(prev => [...prev, ...newFiles]);
      onFileUpload(e.target.files);
      
      // Simulate encryption progress
      newFiles.forEach(file => {
        setTimeout(() => {
          setAttachedFiles(prev => 
            prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f)
          );
        }, 500);
        setTimeout(() => {
          setAttachedFiles(prev => 
            prev.map(f => f.id === file.id ? { ...f, status: 'ready' } : f)
          );
        }, 1500);
      });
    }
  };
  
  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const isProcessing = isEncrypting || isSending || attachedFiles.some(
    f => ['uploading', 'encrypting', 'processing'].includes(f.status)
  );
  
  return (
    <div className="space-y-4">
      {/* Model Provider Bar */}
      <div className="flex justify-center">
        <ModelProviderBar
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>
      
      {/* Main Input Area */}
      <div className="bg-muted/30 rounded-2xl border p-4 space-y-3">
        {/* File Attachments */}
        <FileAttachment
          files={attachedFiles}
          onRemove={removeFile}
        />
        
        {/* Text Input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... Use @ to mention documents or integrations"
            disabled={disabled || isProcessing}
            className={cn(
              "w-full min-h-[60px] max-h-[200px] resize-none",
              "bg-transparent border-0 focus:ring-0 focus:outline-none",
              "placeholder:text-muted-foreground text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            rows={2}
          />
        </div>
        
        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Add File Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="h-9 w-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv"
            />
            
            {/* Retention Mode */}
            <RetentionModeDropdown
              value={retentionMode}
              onChange={handleRetentionChange}
              disabled={disabled || isProcessing}
            />
          </div>
          
          {/* Encryption/Send Status */}
          <div className="flex items-center gap-3">
            {isEncrypting && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Lock className="h-4 w-4 animate-pulse" />
                <span>Encrypting...</span>
              </div>
            )}
            
            {isSending && !isEncrypting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending...</span>
              </div>
            )}
            
            {/* Send Button */}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={disabled || isProcessing || (!message.trim() && attachedFiles.length === 0)}
              className="h-10 w-10 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Connected Sources Bar */}
      <div className="flex justify-center">
        <ConnectedSourcesBar
          integrations={integrations}
          onToggle={onToggleIntegration}
          onConnect={onConnectIntegration}
        />
      </div>
      
      {/* AI Disclaimer */}
      <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
        AI can make mistakes. Always check the accuracy of the responses. Swiss Vault.ai doesn't use any user data to train models.
      </p>
    </div>
  );
}
