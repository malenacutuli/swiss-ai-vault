import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Workspace, WorkspaceVisibility } from '@/hooks/useWorkspaces';

const WORKSPACE_COLORS = [
  { value: 'bg-red-500', label: 'Red' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-yellow-500', label: 'Yellow' },
  { value: 'bg-lime-500', label: 'Lime' },
  { value: 'bg-green-500', label: 'Green' },
  { value: 'bg-emerald-500', label: 'Emerald' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-cyan-500', label: 'Cyan' },
  { value: 'bg-sky-500', label: 'Sky' },
  { value: 'bg-blue-500', label: 'Blue' },
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-violet-500', label: 'Violet' },
  { value: 'bg-purple-500', label: 'Purple' },
  { value: 'bg-fuchsia-500', label: 'Fuchsia' },
  { value: 'bg-pink-500', label: 'Pink' },
];

const WORKSPACE_ICONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

interface WorkspaceSettingsProps {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (workspaceId: string, updates: Partial<Workspace>) => Promise<boolean>;
  isNew?: boolean;
  onCreate?: (name: string, description?: string, visibility?: WorkspaceVisibility) => Promise<Workspace | null>;
}

export function WorkspaceSettings({
  workspace,
  open,
  onOpenChange,
  onSave,
  isNew = false,
  onCreate,
}: WorkspaceSettingsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<WorkspaceVisibility>('private');
  const [color, setColor] = useState('bg-blue-500');
  const [icon, setIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when workspace changes
  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || '');
      setVisibility(workspace.visibility);
      setColor(workspace.color || 'bg-blue-500');
      setIcon(workspace.icon || workspace.name.charAt(0).toUpperCase());
    } else if (isNew) {
      setName('');
      setDescription('');
      setVisibility('private');
      setColor('bg-blue-500');
      setIcon('');
    }
  }, [workspace, isNew, open]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (isNew && onCreate) {
        const newWorkspace = await onCreate(name.trim(), description.trim() || undefined, visibility);
        if (newWorkspace) {
          // Update color and icon if different from defaults
          await onSave(newWorkspace.id, { color, icon: icon || name.charAt(0).toUpperCase() });
          onOpenChange(false);
        }
      } else if (workspace) {
        const success = await onSave(workspace.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          color,
          icon: icon || name.charAt(0).toUpperCase(),
        });
        if (success) {
          onOpenChange(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Create Workspace' : 'Workspace Settings'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Create a new workspace for your team to collaborate.'
              : 'Update your workspace settings and preferences.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-semibold',
                color
              )}
            >
              {icon || name.charAt(0).toUpperCase() || 'W'}
            </div>
            <div>
              <div className="font-medium">{name || 'Workspace Name'}</div>
              <div className="text-sm text-muted-foreground">
                {description || 'No description'}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as WorkspaceVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex flex-col">
                    <span>Private</span>
                    <span className="text-xs text-muted-foreground">Only invited members can access</span>
                  </div>
                </SelectItem>
                <SelectItem value="team">
                  <div className="flex flex-col">
                    <span>Team</span>
                    <span className="text-xs text-muted-foreground">All organization members can access</span>
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex flex-col">
                    <span>Public</span>
                    <span className="text-xs text-muted-foreground">Anyone with the link can view</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-lg transition-all',
                    c.value,
                    color === c.value ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                  )}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon Letter</Label>
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-medium transition-all',
                    (icon || name.charAt(0).toUpperCase()) === i
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isNew ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
