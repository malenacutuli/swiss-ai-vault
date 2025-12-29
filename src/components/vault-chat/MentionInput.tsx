import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FileText, Mail, MessageSquare, Github, BookOpen, X } from '@/icons';
import { cn } from '@/lib/utils';

interface MentionItem {
  id: string;
  type: 'document' | 'gmail' | 'slack' | 'notion' | 'github';
  name: string;
}

export interface MentionInputRef {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
  getMentions: () => MentionItem[];
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: MentionItem[]) => void;
  documents?: Array<{ id: string; name: string }>;
  integrations?: Array<{ type: string; isActive: boolean }>;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onSubmit?: () => void;
  className?: string;
}

const INTEGRATION_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  gmail: { icon: Mail, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800', label: 'Gmail' },
  slack: { icon: MessageSquare, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800', label: 'Slack' },
  notion: { icon: BookOpen, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700', label: 'Notion' },
  github: { icon: Github, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700', label: 'GitHub' },
  document: { icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800', label: 'Document' },
};

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(({
  value,
  onChange,
  onMentionsChange,
  documents = [],
  integrations = [],
  placeholder = "Ask anything... Use @ to mention documents",
  disabled,
  onKeyDown,
  onSubmit,
  className,
}, ref) => {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Build available mention items
  const availableMentions: (MentionItem & { icon: React.ComponentType<{ className?: string }>; color: string })[] = [
    ...documents.map(doc => ({
      id: `doc-${doc.id}`,
      type: 'document' as const,
      name: doc.name,
      ...INTEGRATION_CONFIG.document
    })),
    ...integrations
      .filter(i => i.isActive)
      .map(int => ({
        id: `int-${int.type}`,
        type: int.type as MentionItem['type'],
        name: INTEGRATION_CONFIG[int.type]?.label || int.type,
        ...INTEGRATION_CONFIG[int.type] || INTEGRATION_CONFIG.document
      }))
  ];

  const filteredMentions = availableMentions.filter(m =>
    m.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => {
      onChange('');
      setMentions([]);
      onMentionsChange?.([]);
    },
    getValue: () => value,
    getMentions: () => mentions,
  }));

  // Handle text changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);
    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionFilter(atMatch[1]);
      setShowMentionMenu(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionMenu(false);
    }
  }, [onChange]);

  // Insert mention
  const insertMention = useCallback((mention: MentionItem & { icon?: React.ComponentType<{ className?: string }>; color?: string }) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = value.slice(cursorPosition);

    const before = value.slice(0, atIndex);
    const mentionText = `@${mention.name} `;
    const newValue = before + mentionText + textAfterCursor;

    onChange(newValue);

    // Update mentions list (avoid duplicates)
    const mentionItem: MentionItem = { id: mention.id, type: mention.type, name: mention.name };
    if (!mentions.some(m => m.id === mention.id)) {
      const newMentions = [...mentions, mentionItem];
      setMentions(newMentions);
      onMentionsChange?.(newMentions);
    }

    setShowMentionMenu(false);

    // Focus and move cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, cursorPosition, mentions, onChange, onMentionsChange]);

  // Remove mention
  const removeMention = useCallback((mentionId: string) => {
    const newMentions = mentions.filter(m => m.id !== mentionId);
    setMentions(newMentions);
    onMentionsChange?.(newMentions);
  }, [mentions, onMentionsChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(i => Math.max(i - 1, 0));
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[selectedMentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey && !showMentionMenu) {
      e.preventDefault();
      onSubmit?.();
      return;
    }

    onKeyDown?.(e);
  }, [showMentionMenu, filteredMentions, selectedMentionIndex, insertMention, onSubmit, onKeyDown]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMentionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Active mentions chips */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {mentions.map((mention) => {
            const config = INTEGRATION_CONFIG[mention.type] || INTEGRATION_CONFIG.document;
            const Icon = config.icon;
            return (
              <span
                key={mention.id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                  config.color
                )}
              >
                <Icon className="h-3 w-3" />
                {mention.name}
                <button
                  onClick={() => removeMention(mention.id)}
                  className="ml-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Textarea input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "w-full min-h-[44px] max-h-[200px] resize-none",
          "px-4 py-3 rounded-xl border border-border bg-background",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
          "placeholder:text-muted-foreground text-sm",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ height: 'auto' }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = Math.min(target.scrollHeight, 200) + 'px';
        }}
      />

      {/* Mention autocomplete menu */}
      {showMentionMenu && filteredMentions.length > 0 && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[220px] max-h-[200px] overflow-y-auto z-50"
        >
          <div className="px-3 py-1.5 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Mention context</p>
          </div>
          {filteredMentions.map((mention, index) => {
            const Icon = mention.icon;
            return (
              <button
                key={mention.id}
                onClick={() => insertMention(mention)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors",
                  index === selectedMentionIndex && "bg-muted"
                )}
              >
                <div className={cn("p-1 rounded", mention.color.split(' ').slice(0, 2).join(' '))}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm">{mention.name}</span>
                <span className="text-xs text-muted-foreground ml-auto capitalize">
                  {mention.type}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state for menu */}
      {showMentionMenu && filteredMentions.length === 0 && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[220px] z-50"
        >
          <p className="text-sm text-muted-foreground text-center">
            No documents or integrations found
          </p>
        </div>
      )}
    </div>
  );
});

MentionInput.displayName = 'MentionInput';
