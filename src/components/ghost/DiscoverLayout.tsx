import { useState } from 'react';
import { GhostSidebar, GhostConversation, GhostFolder } from './GhostSidebar';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostFolders } from '@/hooks/useGhostFolders';
import { useNavigate } from 'react-router-dom';
import { GhostSettings } from './GhostSettings';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X, Sun, Moon } from '@/icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface DiscoverLayoutProps {
  children: React.ReactNode;
  activeModule: 'finance' | 'legal' | 'patents' | 'research' | 'security' | 'health' | 'travel' | 'realestate' | 'art';
}

export function DiscoverLayout({ children, activeModule }: DiscoverLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const moduleLabels: Record<string, string> = {
    finance: t('ghost.modules.finance.title'),
    legal: t('ghost.modules.legal.title'),
    patents: t('ghost.modules.patents.title'),
    research: t('ghost.modules.research.title'),
    security: t('ghost.modules.security.title'),
    health: t('ghost.modules.health.title'),
    travel: t('ghost.modules.travel.title'),
    realestate: t('ghost.modules.realestate.title'),
    art: t('ghost.modules.art.title'),
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };
  
  const {
    conversations,
    createConversation,
    deleteConversation,
    exportConversation,
    updateConversationTitle,
    moveToFolder,
  } = useGhostStorage();

  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useGhostFolders();

  // Map conversations to the sidebar format
  const sidebarConversations = conversations.map(c => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount,
    folderId: c.folderId,
    isTemporary: c.isTemporary,
  }));

  const handleNewChat = (isTemporary?: boolean) => {
    createConversation(isTemporary ? 'temporary' : undefined);
    navigate('/ghost');
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    navigate('/ghost');
  };

  const handleExportConversation = async (id: string) => {
    const blob = await exportConversation(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFB] dark:bg-background">
      <GhostSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={sidebarConversations}
        folders={folders}
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={deleteConversation}
        onExportConversation={handleExportConversation}
        onRenameConversation={updateConversationTitle}
        onMoveToFolder={moveToFolder}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onOpenSettings={() => setShowSettings(true)}
        activeModule={activeModule}
      />
      
      <div className="flex-1 flex flex-col">
        {/* Consistent Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border/60 bg-background">
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">{moduleLabels[activeModule] || activeModule}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {children}
      </div>

      <GhostSettings
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}
