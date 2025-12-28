import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Lock, Shield, Upload, Sun, Moon } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  encrypted_title: string | null;
  title_nonce: string;
  model_id: string;
  last_message_at: string | null;
  created_at: string;
  is_encrypted: boolean;
  zero_retention: boolean;
}

interface ConversationListViewProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onImport?: () => void;
  isCreating?: boolean;
  isZeroTrace?: boolean;
  getDisplayTitle: (conv: Conversation) => string;
}

export function ConversationListView({
  conversations,
  onSelect,
  onNewChat,
  onImport,
  isCreating,
  isZeroTrace,
  getDisplayTitle,
}: ConversationListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const filtered = conversations.filter((c) => {
    const title = getDisplayTitle(c);
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">{t('vaultChat.title')}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? t('vaultChat.switchToLight') : t('vaultChat.switchToDark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {isZeroTrace && onImport && (
            <Button variant="outline" onClick={onImport} title={t('vaultChat.importChat')}>
              <Upload className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={onNewChat} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? t('vaultChat.creating') : t('vaultChat.newChat')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('vaultChat.searchPlaceholder')}
          className="pl-10 h-11"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Count */}
      <div className="text-sm text-muted-foreground mb-4">
        {filtered.length} {t('vaultChat.conversations', { count: filtered.length })}
        {searchQuery && ` ${t('vaultChat.matching', { query: searchQuery })}`}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 -mx-2">
        <div className="px-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? t('vaultChat.noMatchingChats') : t('vaultChat.noConversationsYet')}
              </p>
              {!searchQuery && (
                <Button onClick={onNewChat} disabled={isCreating}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('vaultChat.startFirstChat')}
                </Button>
              )}
            </div>
          ) : (
            filtered.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "py-4 px-4 hover:bg-accent/50 cursor-pointer rounded-lg mb-1",
                  "transition-colors border border-transparent hover:border-border"
                )}
              >
                <div className="font-medium truncate">
                  {getDisplayTitle(conversation)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {conversation.last_message_at
                    ? formatRelativeTime(conversation.last_message_at)
                    : t('vaultChat.newConversation')}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Security footer */}
      <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          {t('vaultChat.security.aes256')}
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          {t('vaultChat.security.swissHosted')}
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          {t('vaultChat.security.zeroKnowledge')}
        </div>
      </div>
    </div>
  );
}
