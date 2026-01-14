// src/components/agents/AgentDashboard.tsx
import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { TaskCard } from './TaskCard';
import { TaskDetails } from './TaskDetails';
import { TaskCreationModal } from './TaskCreationModal';

export function AgentDashboard() {
  const { activeTasks, recentTasks, isLoading, error, refetch } = useAgentTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const allTasks = [...activeTasks, ...recentTasks];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Tasks</h1>
          <p className="text-gray-500">Monitor and manage your AI agent tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="bg-[#1D4E5F] hover:bg-[#163d4d]"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task List */}
        <div className="space-y-6">
          {activeTasks.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Active Tasks ({activeTasks.length})
              </h2>
              <div className="space-y-3">
                {activeTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    {...task}
                    onClick={setSelectedTaskId}
                    isSelected={selectedTaskId === task.id}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3">
              Recent Tasks {recentTasks.length > 0 && `(${recentTasks.length})`}
            </h2>
            {allTasks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                <p className="text-gray-500">No tasks yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Create your first task to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.slice(0, 10).map(task => (
                  <TaskCard
                    key={task.id}
                    {...task}
                    onClick={setSelectedTaskId}
                    isSelected={selectedTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task Details */}
        <div className="lg:sticky lg:top-6 h-fit">
          {selectedTaskId ? (
            <TaskDetails
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-400">
              <p>Select a task to view details</p>
              <p className="text-sm mt-2">
                Click on any task card to see execution steps and outputs
              </p>
            </div>
          )}
        </div>
      </div>

      <TaskCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(taskId) => {
          setSelectedTaskId(taskId);
          refetch();
        }}
      />
    </div>
  );
}
