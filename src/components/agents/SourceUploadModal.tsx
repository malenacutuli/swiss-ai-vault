import React, { useState, useCallback } from 'react';
import {
  X,
  Search,
  Upload,
  Link,
  HardDrive,
  Clipboard,
  FileText,
  Globe,
  Zap,
} from '@/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';

interface SourceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadFiles?: (files: File[]) => void;
  onAddUrl?: (url: string) => void;
  onAddText?: (text: string) => void;
  onWebSearch?: (query: string) => void;
  onConnectDrive?: () => void;
}

type ActiveInput = 'none' | 'url' | 'text';
type SearchMode = 'web' | 'quick';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
  'video/*': ['.mp4', '.webm', '.mov'],
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function SourceUploadModal({
  open,
  onOpenChange,
  onUploadFiles,
  onAddUrl,
  onAddText,
  onWebSearch,
  onConnectDrive,
}: SourceUploadModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('web');
  const [activeInput, setActiveInput] = useState<ActiveInput>('none');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter((file) => file.size <= MAX_FILE_SIZE);
      if (validFiles.length > 0 && onUploadFiles) {
        onUploadFiles(validFiles);
        onOpenChange(false);
      }
    },
    [onUploadFiles, onOpenChange]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    noClick: true, // Prevent default click on dropzone
  });

  const handleSearch = () => {
    if (searchQuery.trim() && onWebSearch) {
      onWebSearch(searchQuery);
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim() && onAddUrl) {
      onAddUrl(urlInput);
      setUrlInput('');
      setActiveInput('none');
      onOpenChange(false);
    }
  };

  const handleAddText = () => {
    if (textInput.trim() && onAddText) {
      onAddText(textInput);
      setTextInput('');
      setActiveInput('none');
      onOpenChange(false);
    }
  };

  const sourceButtons = [
    {
      id: 'upload',
      label: 'Upload files',
      icon: Upload,
      onClick: () => openFilePicker(), // Use dropzone's built-in open method
    },
    {
      id: 'url',
      label: 'Websites',
      icon: Link,
      onClick: () => setActiveInput(activeInput === 'url' ? 'none' : 'url'),
    },
    {
      id: 'drive',
      label: 'Drive',
      icon: HardDrive,
      onClick: onConnectDrive,
    },
    {
      id: 'text',
      label: 'Copied text',
      icon: Clipboard,
      onClick: () => setActiveInput(activeInput === 'text' ? 'none' : 'text'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 bg-white">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-medium text-foreground">
            Create audio and video summaries from{' '}
            <span className="text-[#1D4E5F]">Your documents</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Upload files, add URLs, or paste text to analyze. Powered by Swiss AI.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Search Section */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search the web for sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 pr-4 h-11 bg-muted/30 border-border/50"
              />
            </div>

            {/* Toggle Pills */}
            <div className="flex gap-2">
              <button
                onClick={() => setSearchMode('web')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
                  searchMode === 'web'
                    ? 'bg-[#1D4E5F] text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Web
              </button>
              <button
                onClick={() => setSearchMode('quick')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
                  searchMode === 'quick'
                    ? 'bg-[#1D4E5F] text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Quick Research
              </button>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-[#1D4E5F] bg-[#1D4E5F]/5'
                : 'border-border/50 hover:border-[#1D4E5F]/50 hover:bg-muted/20'
            )}
          >
            <input {...getInputProps()} />
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? 'Drop files here...' : 'or drop your files here'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              PDF, DOCX, XLSX, images, audio, video (max 20MB)
            </p>
          </div>

          {/* Source Type Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {sourceButtons.map((button) => {
              const Icon = button.icon;
              const isActive =
                (button.id === 'url' && activeInput === 'url') ||
                (button.id === 'text' && activeInput === 'text');

              return (
                <button
                  key={button.id}
                  onClick={button.onClick}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-lg transition-all',
                    'border border-border/50',
                    isActive
                      ? 'bg-[#1D4E5F]/10 border-[#1D4E5F]/30'
                      : 'bg-white hover:bg-muted/30 hover:border-border'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 mb-1.5',
                      isActive ? 'text-[#1D4E5F]' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs',
                      isActive ? 'text-[#1D4E5F]' : 'text-muted-foreground'
                    )}
                  >
                    {button.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* URL Input */}
          {activeInput === 'url' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Input
                placeholder="Paste URL (supports YouTube, articles, web pages)..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                className="h-10"
                autoFocus
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  size="sm"
                  className="bg-[#722F37] hover:bg-[#5a252c]"
                >
                  Add URL
                </Button>
              </div>
            </div>
          )}

          {/* Text Input */}
          {activeInput === 'text' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Textarea
                placeholder="Paste or type your text content here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[120px] resize-none"
                autoFocus
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddText}
                  disabled={!textInput.trim()}
                  size="sm"
                  className="bg-[#722F37] hover:bg-[#5a252c]"
                >
                  Add Text
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
