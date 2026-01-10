import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { MonacoEditor, detectLanguage } from './MonacoEditor';
import { EditorTabs, EditorTab } from './EditorTabs';
import { FileTree, FileNode, buildFileTree } from './FileTree';
import { EditorStatusBar } from './EditorStatusBar';
import { QuickOpen, useQuickOpen } from './QuickOpen';

export interface FileContent {
  path: string;
  content: string;
  originalContent?: string;
}

interface IDEProps {
  files: FileContent[];
  onSave?: (path: string, content: string) => void;
  onFileLoad?: (path: string) => Promise<string>;
  className?: string;
  defaultOpenFiles?: string[];
}

export function IDE({
  files,
  onSave,
  onFileLoad,
  className,
  defaultOpenFiles = [],
}: IDEProps) {
  // Build file tree from paths
  const fileTree = buildFileTree(files.map((f) => f.path));
  const allPaths = files.map((f) => f.path);

  // State
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map(files.map((f) => [f.path, f.content]))
  );
  const [originalContents, setOriginalContents] = useState<Map<string, string>>(
    new Map(files.map((f) => [f.path, f.originalContent || f.content]))
  );
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Quick open
  const { open: quickOpenOpen, setOpen: setQuickOpenOpen } = useQuickOpen();

  // Get active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeContent = activeTab ? fileContents.get(activeTab.path) || '' : '';

  // Open default files on mount
  useEffect(() => {
    for (const path of defaultOpenFiles) {
      openFile(path);
    }
  }, []);

  // Open file in editor
  const openFile = useCallback(async (path: string) => {
    // Check if tab already exists
    const existingTab = tabs.find((t) => t.path === path);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Load content if needed
    let content = fileContents.get(path);
    if (!content && onFileLoad) {
      try {
        content = await onFileLoad(path);
        setFileContents((prev) => new Map(prev).set(path, content!));
        setOriginalContents((prev) => new Map(prev).set(path, content!));
      } catch (error) {
        console.error('Failed to load file:', error);
        return;
      }
    }

    // Create new tab
    const filename = path.split('/').pop() || path;
    const newTab: EditorTab = {
      id: `tab-${Date.now()}`,
      path,
      filename,
      language: detectLanguage(filename),
      isDirty: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs, fileContents, onFileLoad]);

  // Close tab
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const newTabs = prev.filter((t) => t.id !== tabId);

      // Update active tab if closing current
      if (tabId === activeTabId && newTabs.length > 0) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        setActiveTabId(newTabs[newIdx].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }

      return newTabs;
    });
  }, [activeTabId]);

  // Handle content change
  const handleContentChange = useCallback((value: string) => {
    if (!activeTab) return;

    setFileContents((prev) => new Map(prev).set(activeTab.path, value));

    // Mark as dirty if different from original
    const original = originalContents.get(activeTab.path) || '';
    const isDirty = value !== original;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, isDirty } : t
      )
    );
  }, [activeTab, originalContents]);

  // Handle save
  const handleSave = useCallback((value: string) => {
    if (!activeTab) return;

    onSave?.(activeTab.path, value);

    // Update original content and clear dirty
    setOriginalContents((prev) => new Map(prev).set(activeTab.path, value));
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, isDirty: false } : t
      )
    );
  }, [activeTab, onSave]);

  // Handle cursor change
  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorPosition({ line, column });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S - Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab) {
          handleSave(activeContent);
        }
      }
      // Cmd/Ctrl+W - Close tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeContent, activeTabId, handleSave, closeTab]);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <FileTree
            files={fileTree}
            selectedPath={activeTab?.path || null}
            onFileSelect={openFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor Panel */}
        <ResizablePanel defaultSize={80}>
          <div className="flex flex-col h-full">
            {/* Tabs */}
            <EditorTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={closeTab}
            />

            {/* Editor */}
            <div className="flex-1 min-h-0">
              {activeTab ? (
                <MonacoEditor
                  value={activeContent}
                  path={activeTab.path}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  onCursorChange={handleCursorChange}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <p className="text-lg font-medium">No file open</p>
                    <p className="text-sm mt-1">
                      Select a file from the explorer or press{' '}
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                        ⌘P
                      </kbd>{' '}
                      to search
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Bar */}
            {activeTab && (
              <EditorStatusBar
                line={cursorPosition.line}
                column={cursorPosition.column}
                language={activeTab.language}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Quick Open Dialog */}
      <QuickOpen
        open={quickOpenOpen}
        onOpenChange={setQuickOpenOpen}
        files={allPaths}
        onFileSelect={openFile}
      />
    </div>
  );
}

// Export all components
export { MonacoEditor, detectLanguage } from './MonacoEditor';
export { EditorTabs, type EditorTab } from './EditorTabs';
export { FileTree, type FileNode, buildFileTree } from './FileTree';
export { EditorStatusBar } from './EditorStatusBar';
export { QuickOpen, useQuickOpen } from './QuickOpen';
