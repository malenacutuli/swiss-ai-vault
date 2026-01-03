import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  FolderKanban, 
  MoreHorizontal, 
  Archive, 
  Trash2, 
  Edit2,
  ArrowLeft,
  Loader2,
  FileText,
  Brain,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  getProjects, 
  deleteProject, 
  archiveProject, 
  unarchiveProject,
  type MemoryProject 
} from '@/lib/memory/memory-store';
import { CreateProjectDialog } from '@/components/memory/CreateProjectDialog';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function MemoryProjectsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isUnlocked, isInitialized: vaultInitialized, getMasterKey } = useEncryptionContext();
  const [projects, setProjects] = useState<MemoryProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<MemoryProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await getProjects();
      // Separate active and archived
      const active = loaded.filter(p => !p.isArchived).sort((a, b) => b.updatedAt - a.updatedAt);
      const archived = loaded.filter(p => p.isArchived).sort((a, b) => b.updatedAt - a.updatedAt);
      setProjects(active);
      setArchivedProjects(archived);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Check if vault needs unlock
  useEffect(() => {
    if (vaultInitialized && !isUnlocked) {
      setShowUnlock(true);
    }
  }, [vaultInitialized, isUnlocked]);

  const handleDelete = async (id: string) => {
    const key = getMasterKey();
    if (!key) {
      toast({ title: 'Vault locked', description: 'Please unlock your vault first', variant: 'destructive' });
      setShowUnlock(true);
      return;
    }
    
    try {
      await deleteProject(id, key);
      await loadProjects();
      toast({ title: 'Project deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete project', variant: 'destructive' });
    }
    setDeleteConfirm(null);
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveProject(id);
      await loadProjects();
      toast({ title: 'Project archived' });
    } catch (error) {
      toast({ title: 'Failed to archive project', variant: 'destructive' });
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await unarchiveProject(id);
      await loadProjects();
      toast({ title: 'Project restored' });
    } catch (error) {
      toast({ title: 'Failed to restore project', variant: 'destructive' });
    }
  };

  const handleProjectCreated = () => {
    setShowCreateDialog(false);
    loadProjects();
  };

  const displayProjects = showArchived ? archivedProjects : projects;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Back to Chat */}
        <button 
          onClick={() => navigate('/ghost')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('projects.backToChat', 'Back to Chat')}
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{t('projects.title', 'Projects')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('projects.subtitle', 'Organize documents and chat with specific context')}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('projects.newProject', 'New Project')}
          </Button>
        </div>

        {/* Archive Toggle */}
        {archivedProjects.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <Button
              variant={showArchived ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowArchived(false)}
            >
              {t('projects.active', 'Active')} ({projects.length})
            </Button>
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowArchived(true)}
            >
              <Archive className="h-4 w-4 mr-1" />
              {t('projects.archived', 'Archived')} ({archivedProjects.length})
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-full mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : displayProjects.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FolderKanban className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {showArchived ? t('projects.noArchivedProjects', 'No archived projects') : t('projects.noProjectsYet', 'No projects yet')}
              </h3>
              <CardDescription className="text-center mb-4 max-w-sm">
                {showArchived 
                  ? t('projects.archivedWillAppear', 'Archived projects will appear here')
                  : t('projects.createToOrganize', 'Create a project to organize documents and chat with specific context')
                }
              </CardDescription>
              {!showArchived && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('projects.createFirst', 'Create Your First Project')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Projects Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayProjects.map((project) => (
              <Card
                key={project.id}
                className="group cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/ghost/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div 
                        className="p-1.5 rounded"
                        style={{ backgroundColor: project.color ? `${project.color}20` : 'hsl(var(--primary) / 0.1)' }}
                      >
                        <FolderKanban 
                          className="h-4 w-4" 
                          style={{ color: project.color || 'hsl(var(--primary))' }}
                        />
                      </div>
                      <CardTitle className="text-base truncate">{project.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ghost/projects/${project.id}`);
                        }}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          {t('projects.edit', 'Edit')}
                        </DropdownMenuItem>
                        {showArchived ? (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchive(project.id);
                          }}>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('projects.restore', 'Restore')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(project.id);
                          }}>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('projects.archive', 'Archive')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('projects.delete', 'Delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="line-clamp-2 text-sm">
                    {project.description || t('projects.noDescription', 'No description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {project.documentIds.length} {t('projects.documents', 'documents')}
                    </span>
                    <span>•</span>
                    <span>{t('projects.updated', 'Updated')} {formatDistanceToNow(project.updatedAt, { addSuffix: true })}</span>
                  </div>
                  {project.instructions && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      {t('projects.customInstructions', 'Custom instructions')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={handleProjectCreated}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('projects.deleteConfirmTitle', 'Delete Project?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('projects.deleteConfirmDescription', 'This will permanently delete this project. Documents in the project will not be deleted from your memory.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('projects.delete', 'Delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Vault Unlock Dialog */}
        <VaultUnlockDialog
          open={showUnlock}
          onOpenChange={setShowUnlock}
        />
      </div>
    </div>
  );
}
