import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AgentVisibility } from '@/hooks/useCustomAgents';

const AVAILABLE_MODELS = [
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Best for most tasks' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus', description: 'Most capable' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'OpenAI flagship' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Long context' },
];

export interface AgentConfig {
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  context_instructions: string;
  starter_prompts: string[];
  visibility: AgentVisibility;
}

interface AgentConfigFormProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  onGeneratePrompt?: () => void;
  isGenerating?: boolean;
}

export function AgentConfigForm({
  config,
  onChange,
  onGeneratePrompt,
  isGenerating,
}: AgentConfigFormProps) {
  const [newStarterPrompt, setNewStarterPrompt] = useState('');

  const updateField = <K extends keyof AgentConfig>(field: K, value: AgentConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  const addStarterPrompt = () => {
    if (newStarterPrompt.trim()) {
      updateField('starter_prompts', [...config.starter_prompts, newStarterPrompt.trim()]);
      setNewStarterPrompt('');
    }
  };

  const removeStarterPrompt = (index: number) => {
    updateField('starter_prompts', config.starter_prompts.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              placeholder="My Research Assistant"
              value={config.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A helpful assistant that..."
              value={config.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              value={config.visibility}
              onValueChange={(v) => updateField('visibility', v as AgentVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private - Only you</SelectItem>
                <SelectItem value="workspace">Workspace - Team members</SelectItem>
                <SelectItem value="public">Public - Anyone can use</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">System Prompt</CardTitle>
              <CardDescription>
                Define the agent's personality, expertise, and behavior
              </CardDescription>
            </div>
            {onGeneratePrompt && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGeneratePrompt}
                disabled={isGenerating || !config.name}
              >
                {isGenerating ? (
                  <Sparkles className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="You are a helpful research assistant specialized in..."
            value={config.system_prompt}
            onChange={(e) => updateField('system_prompt', e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {config.system_prompt.length} characters
          </p>
        </CardContent>
      </Card>

      {/* Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Model Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={config.model}
              onValueChange={(v) => updateField('model', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex items-center gap-2">
                      <span>{model.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({model.description})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{config.temperature}</span>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([v]) => updateField('temperature', v)}
              min={0}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Tokens</Label>
              <span className="text-sm text-muted-foreground">{config.max_tokens}</span>
            </div>
            <Slider
              value={[config.max_tokens]}
              onValueChange={([v]) => updateField('max_tokens', v)}
              min={256}
              max={8192}
              step={256}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>256</span>
              <span>8192</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Context Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Context Instructions</CardTitle>
          <CardDescription>
            Additional instructions appended to each conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Always cite sources. Format responses in markdown..."
            value={config.context_instructions}
            onChange={(e) => updateField('context_instructions', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Starter Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Starter Prompts</CardTitle>
          <CardDescription>
            Suggested prompts shown to users when starting a conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.starter_prompts.map((prompt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Badge variant="secondary" className="gap-1 py-1.5 px-3">
                  <span className="max-w-[200px] truncate">{prompt}</span>
                  <button
                    onClick={() => removeStarterPrompt(i)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a starter prompt..."
              value={newStarterPrompt}
              onChange={(e) => setNewStarterPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStarterPrompt();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={addStarterPrompt}
              disabled={!newStarterPrompt.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
