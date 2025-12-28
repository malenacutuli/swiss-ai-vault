import { useState } from 'react';
import { GhostSidebar, GhostConversation, GhostFolder } from './GhostSidebar';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostFolders } from '@/hooks/useGhostFolders';
import { useNavigate } from 'react-router-dom';
import { GhostSettings } from './GhostSettings';

interface DiscoverLayoutProps {
  children: React.ReactNode;
  activeModule: 'finance' | 'legal' | 'patents' | 'research';
}

export function DiscoverLayout({ children, activeModule }: DiscoverLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
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
    <div className="flex min-h-screen bg-[#FAFAFB]">
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
      
      {children}

      <GhostSettings
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}
