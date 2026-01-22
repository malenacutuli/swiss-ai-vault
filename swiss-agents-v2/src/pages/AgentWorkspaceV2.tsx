/**
 * AgentWorkspaceV2 Page
 * Full workspace layout for Swiss Agents V2
 */

import React, { useState } from 'react';
import { AgentChat } from '../components/AgentChat';
import { AgentTerminal } from '../components/AgentTerminal';
import { useAgent } from '../hooks/useAgent';

// ===========================================
// TYPES
// ===========================================

type PanelView = 'terminal' | 'preview' | 'code' | 'files';

// ===========================================
// COMPONENT
// ===========================================

export const AgentWorkspaceV2: React.FC = () => {
  const [activePanel, setActivePanel] = useState<PanelView>('terminal');
  const agent = useAgent();

  const panels: { id: PanelView; label: string; icon: string }[] = [
    { id: 'terminal', label: 'Terminal', icon: '💻' },
    { id: 'preview', label: 'Preview', icon: '👁️' },
    { id: 'code', label: 'Code', icon: '</>' },
    { id: 'files', label: 'Files', icon: '📁' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            Swiss Agents V2
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
            Test Environment
          </span>
        </div>

        <div className="flex-1" />

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              agent.state === 'executing' || agent.state === 'planning'
                ? 'bg-green-500 animate-pulse'
                : agent.state === 'failed'
                ? 'bg-red-500'
                : 'bg-gray-400'
            }`}
          />
          <span className="text-gray-600 dark:text-gray-400 capitalize">
            {agent.state}
          </span>
        </div>

        {/* Task ID */}
        {agent.taskId && (
          <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
            Task: {agent.taskId.slice(0, 8)}...
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-[400px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          <AgentChat className="flex-1" />
        </div>

        {/* Right Panel - Workspace */}
        <div className="flex-1 flex flex-col">
          {/* Panel Tabs */}
          <div className="h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-1">
            {panels.map((panel) => (
              <button
                key={panel.id}
                onClick={() => setActivePanel(panel.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activePanel === panel.id
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="mr-2">{panel.icon}</span>
                {panel.label}
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 p-4 overflow-hidden">
            {activePanel === 'terminal' && (
              <AgentTerminal
                steps={agent.steps}
                isRunning={agent.isStreaming}
                className="h-full"
              />
            )}

            {activePanel === 'preview' && (
              <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-3">👁️</div>
                  <div className="font-medium">No Preview Available</div>
                  <div className="text-sm">
                    Preview will appear when the agent creates visual content
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'code' && (
              <div className="h-full bg-gray-900 rounded-xl overflow-hidden">
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-3">&lt;/&gt;</div>
                    <div className="font-medium">Code Editor</div>
                    <div className="text-sm">
                      Code will appear here when files are created
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'files' && (
              <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Workspace Files
                </div>
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-3">📁</div>
                  <div>No files yet</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center px-4 text-xs text-gray-500 dark:text-gray-500">
        <div className="flex items-center gap-4">
          <span>Manus API: Connected</span>
          <span>•</span>
          <span>Sandbox: Ready</span>
          <span>•</span>
          <span>
            Phase: {agent.currentPhaseId}/{agent.plan?.phases.length || 0}
          </span>
        </div>
        <div className="flex-1" />
        <div>Swiss Agents V2 - Test Environment</div>
      </footer>
    </div>
  );
};

export default AgentWorkspaceV2;
