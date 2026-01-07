import React, { useState } from 'react';
import {
  Plus,
  Search,
  Globe,
  Zap,
  FileText,
  Link,
  Type,
  Trash2,
  Headphones,
  Video,
  Network,
  Layers,
  HelpCircle,
  BarChart2,
  Monitor,
  Table,
  Paperclip,
  Send,
  Sparkles,
  BookOpen,
} from '@/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Source {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  icon?: string;
}

interface StudioLayoutProps {
  sources?: Source[];
  onAddSource?: () => void;
  onDeleteSource?: (id: string) => void;
  onDeepResearch?: () => void;
  onCreateOutput?: (type: string) => void;
  onSendMessage?: (message: string) => void;
}

const OUTPUT_OPTIONS = [
  { id: 'audio', label: 'Audio Summary', icon: Headphones },
  { id: 'video', label: 'Video Summary', icon: Video },
  { id: 'mindmap', label: 'Mind Map', icon: Network },
  { id: 'report', label: 'Reports', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'infographic', label: 'Infographic', icon: BarChart2 },
  { id: 'presentation', label: 'Presentation', icon: Monitor },
  { id: 'table', label: 'Data Table', icon: Table },
];

const getSourceIcon = (type: Source['type']) => {
  switch (type) {
    case 'file':
      return FileText;
    case 'url':
      return Link;
    case 'text':
      return Type;
    default:
      return FileText;
  }
};

export function StudioLayout({
  sources = [],
  onAddSource,
  onDeleteSource,
  onDeepResearch,
  onCreateOutput,
  onSendMessage,
}: StudioLayoutProps) {
  const [webEnabled, setWebEnabled] = useState(false);
  const [quickResearchEnabled, setQuickResearchEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = () => {
    if (messageInput.trim() && onSendMessage) {
      onSendMessage(messageInput);
      setMessageInput('');
    }
  };

  return (
    <div className="flex h-full w-full bg-[#FAFAFA]">
      {/* LEFT - Sources Column */}
      <div className="w-[300px] border-r border-border/50 bg-white flex flex-col">
        <div className="p-4 space-y-4">
          {/* Add Sources Button */}
          <Button
            onClick={onAddSource}
            className="w-full bg-[#722F37] hover:bg-[#5a252c] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add sources
          </Button>

          {/* Deep Research CTA */}
          <div
            onClick={onDeepResearch}
            className="p-4 rounded-lg border border-[#1D4E5F]/20 bg-gradient-to-br from-[#1D4E5F]/5 to-transparent cursor-pointer hover:border-[#1D4E5F]/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[#1D4E5F]/10">
                <Sparkles className="h-4 w-4 text-[#1D4E5F]" />
              </div>
              <span className="font-medium text-sm text-[#1D4E5F]">Deep Research</span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI-powered comprehensive analysis with citations
            </p>
          </div>

          {/* Search with Toggles */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/30 border-0"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Web</span>
              </div>
              <Switch
                checked={webEnabled}
                onCheckedChange={setWebEnabled}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Quick Research</span>
              </div>
              <Switch
                checked={quickResearchEnabled}
                onCheckedChange={setQuickResearchEnabled}
                className="scale-75"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 mx-4" />

        {/* Saved Sources Section */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Saved Sources</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {sources.length}
            </span>
          </div>

          <ScrollArea className="flex-1">
            {sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No sources added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => {
                  const SourceIcon = getSourceIcon(source.type);
                  return (
                    <div
                      key={source.id}
                      className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <SourceIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">
                        {source.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                        {source.type}
                      </span>
                      <button
                        onClick={() => onDeleteSource?.(source.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* CENTER - Chat Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/50">
        {/* Chat Header */}
        <div className="h-14 border-b border-border/50 flex items-center px-6">
          <h2 className="font-medium text-foreground">Studio Chat</h2>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          {sources.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-muted/30 mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Add a source to begin
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Upload files, paste URLs, or add text to start exploring with AI
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chat messages would go here */}
              <div className="text-center text-sm text-muted-foreground py-4">
                Start a conversation about your sources
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onAddSource}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Ask about your sources..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="h-8 w-8 bg-[#722F37] hover:bg-[#5a252c]"
              disabled={!messageInput.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT - Studio Column */}
      <div className="w-[300px] border-l border-border/50 bg-white flex flex-col">
        <div className="p-4">
          <h3 className="font-medium text-foreground mb-4">Create</h3>

          {/* 3x3 Grid of Output Options */}
          <div className="grid grid-cols-3 gap-2">
            {OUTPUT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => onCreateOutput?.(option.id)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg",
                    "bg-white border border-border/50 shadow-sm",
                    "hover:border-[#722F37]/30 hover:shadow-md transition-all",
                    "group"
                  )}
                >
                  <div className="p-2 rounded-md bg-muted/30 group-hover:bg-[#722F37]/10 transition-colors mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-[#722F37] transition-colors" />
                  </div>
                  <span className="text-[10px] text-center text-muted-foreground group-hover:text-foreground leading-tight">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Studio Content */}
        <div className="flex-1 p-4 pt-0">
          <div className="h-px bg-border/50 mb-4" />
          <div className="text-xs text-muted-foreground">
            Select an output type to generate content from your sources
          </div>
        </div>
      </div>
    </div>
  );
}
