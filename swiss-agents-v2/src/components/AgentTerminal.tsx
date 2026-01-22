/**
 * AgentTerminal Component
 * Displays shell command output and tool execution logs
 */

import React, { useRef, useEffect } from 'react';
import type { AgentStep } from '../hooks/useAgent';

// ===========================================
// TYPES
// ===========================================

export interface AgentTerminalProps {
  steps: AgentStep[];
  isRunning: boolean;
  className?: string;
}

// ===========================================
// COMPONENT
// ===========================================

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  steps,
  isRunning,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [steps]);

  const getToolIcon = (toolName: string): string => {
    switch (toolName) {
      case 'shell':
        return '💻';
      case 'file':
        return '📄';
      case 'search':
        return '🔍';
      case 'browser_navigate':
      case 'browser_click':
      case 'browser_input':
        return '🌐';
      case 'plan':
        return '📋';
      case 'message':
        return '💬';
      default:
        return '⚡';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div
      className={`bg-gray-900 rounded-xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 text-center text-sm text-gray-400 font-mono">
          SwissVault Terminal
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Running
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
      >
        {steps.length === 0 ? (
          <div className="text-gray-500">
            <span className="text-green-400">$</span> Waiting for task...
            <span className="animate-pulse">_</span>
          </div>
        ) : (
          steps.map((step, index) => (
            <div key={step.id} className="mb-4">
              {/* Step Header */}
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <span>{getToolIcon(step.toolName)}</span>
                <span className="text-purple-400">{step.toolName}</span>
                <span className={getStatusColor(step.status)}>
                  [{step.status}]
                </span>
                <span className="text-gray-600 text-xs">
                  {new Date(step.startedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Tool Input */}
              {step.toolInput && (
                <div className="pl-6 text-gray-500 text-xs mb-1">
                  {step.toolName === 'shell' && step.toolInput.command && (
                    <div>
                      <span className="text-green-400">$</span>{' '}
                      <span className="text-white">{String(step.toolInput.command)}</span>
                    </div>
                  )}
                  {step.toolName === 'file' && (
                    <div>
                      <span className="text-blue-400">{String(step.toolInput.action)}</span>{' '}
                      <span className="text-yellow-300">{String(step.toolInput.path)}</span>
                    </div>
                  )}
                  {step.toolName === 'search' && (
                    <div>
                      <span className="text-blue-400">Searching:</span>{' '}
                      <span className="text-white">
                        {Array.isArray(step.toolInput.queries)
                          ? step.toolInput.queries.join(', ')
                          : String(step.toolInput.queries)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Output */}
              {step.output && (
                <div className="pl-6 text-gray-300 whitespace-pre-wrap break-all">
                  {step.output}
                </div>
              )}

              {/* Error */}
              {step.error && (
                <div className="pl-6 text-red-400">
                  Error: {step.error}
                </div>
              )}

              {/* Running indicator */}
              {step.status === 'running' && (
                <div className="pl-6 text-yellow-400 animate-pulse">
                  Processing...
                </div>
              )}
            </div>
          ))
        )}

        {/* Cursor */}
        {isRunning && (
          <div className="text-green-400">
            <span>$</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{steps.length} operations</span>
        <span>Sandbox: Active</span>
      </div>
    </div>
  );
};

export default AgentTerminal;
