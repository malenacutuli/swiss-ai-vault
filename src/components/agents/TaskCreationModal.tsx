// src/components/agents/TaskCreationModal.tsx
import React, { useState } from 'react';
import { X, Loader2, Sparkles, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (taskId: string) => void;
}

const QUICK_TEMPLATES = [
  { id: 'research', name: 'Research', description: 'Deep research on any topic', icon: '🔍' },
  { id: 'document', name: 'Create Document', description: 'Generate DOCX, PPTX, or XLSX', icon: '📄' },
  { id: 'analyze', name: 'Analyze Data', description: 'Analyze CSV or spreadsheet data', icon: '📊' },
  { id: 'code', name: 'Write Code', description: 'Generate or review code', icon: '💻' },
];

export function TaskCreationModal({ isOpen, onClose, onCreated }: TaskCreationModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [privacyMode, setPrivacyMode] = useState('standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create task
      const { data, error: createError } = await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'create',
          prompt: prompt.trim(),
          config: {
            model,
            privacy_mode: privacyMode,
            template: selectedTemplate
          }
        }
      });

      if (createError) throw createError;

      // Start task
      await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'start',
          run_id: data.run_id
        }
      });

      onCreated(data.run_id);
      onClose();

      // Reset form
      setPrompt('');
      setSelectedTemplate(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId === selectedTemplate ? null : templateId);

    // Pre-fill prompt based on template
    const templates: Record<string, string> = {
      research: 'Research and create a comprehensive report on: ',
      document: 'Create a professional document about: ',
      analyze: 'Analyze the following data and provide insights: ',
      code: 'Write code to: '
    };

    if (templateId !== selectedTemplate && templates[templateId]) {
      setPrompt(templates[templateId]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#1D4E5F]" />
            Create New Task
          </DialogTitle>
          <DialogDescription>
            Describe what you want the AI agent to accomplish
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Templates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Start</Label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedTemplate === template.id
                      ? 'border-[#1D4E5F] bg-[#1D4E5F]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{template.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-gray-500">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <Label htmlFor="prompt">Task Description</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              className="min-h-[120px] mt-1"
            />
          </div>

          {/* Options Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Smart)</SelectItem>
                  <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Privacy Mode</Label>
              <Select value={privacyMode} onValueChange={setPrivacyMode}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Standard
                    </div>
                  </SelectItem>
                  <SelectItem value="vault">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Vault (Encrypted)
                    </div>
                  </SelectItem>
                  <SelectItem value="ghost">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-500" />
                      Ghost (Zero Retention)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !prompt.trim()}
            className="bg-[#1D4E5F] hover:bg-[#163d4d]"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
