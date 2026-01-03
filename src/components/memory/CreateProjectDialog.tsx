import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createProject } from '@/lib/memory/memory-store';
import { useToast } from '@/hooks/use-toast';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
];

export function CreateProjectDialog({ open, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[5]); // default blue
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: t('projects.create.nameRequired', 'Name required'), description: t('projects.create.enterName', 'Please enter a project name'), variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        color,
      });
      toast({ title: t('projects.create.success', 'Project created') });
      onCreated();
      // Reset form
      setName('');
      setDescription('');
      setInstructions('');
      setColor(PROJECT_COLORS[5]);
    } catch (error) {
      toast({ title: t('projects.create.failed', 'Failed to create project'), variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" style={{ color }} />
            {t('projects.create.title', 'Create Project')}
          </DialogTitle>
          <DialogDescription>
            {t('projects.create.description', 'Organize documents and set custom AI instructions for this project.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('projects.create.name', 'Name')}</Label>
            <Input
              id="name"
              placeholder={t('projects.create.namePlaceholder', 'e.g., Tax Documents 2024')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('projects.create.descriptionLabel', 'Description (optional)')}</Label>
            <Input
              id="description"
              placeholder={t('projects.create.descriptionPlaceholder', 'Brief description of this project')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">{t('projects.create.instructionsLabel', 'Custom Instructions (optional)')}</Label>
            <Textarea
              id="instructions"
              placeholder={t('projects.create.instructionsPlaceholder', 'Custom system prompt for AI when chatting about this project...')}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('projects.create.instructionsHint', 'These instructions will be used when you chat with documents in this project.')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('projects.create.color', 'Color')}</Label>
            <div className="flex items-center gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('projects.create.submit', 'Create Project')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
