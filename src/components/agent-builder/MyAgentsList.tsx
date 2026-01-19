import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontal,
  Play,
  Edit,
  Copy,
  Trash2,
  Globe,
  Lock,
  Users,
  Clock,
  Sparkles,
  History,
  Share,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import type { CustomAgent } from '@/hooks/useCustomAgents';

interface MyAgentsListProps {
  agents: CustomAgent[];
  isLoading?: boolean;
  onEdit: (agent: CustomAgent) => void;
  onClone: (agent: CustomAgent) => void;
  onDelete: (agent: CustomAgent) => void;
  onRun: (agent: CustomAgent) => void;
  onViewVersions: (agent: CustomAgent) => void;
  onShare: (agent: CustomAgent) => void;
}

const visibilityIcons = {
  private: Lock,
  workspace: Users,
  public: Globe,
};

const visibilityLabels = {
  private: 'Private',
  workspace: 'Workspace',
  public: 'Public',
};

export function MyAgentsList({
  agents,
  isLoading,
  onEdit,
  onClone,
  onDelete,
  onRun,
  onViewVersions,
  onShare,
}: MyAgentsListProps) {
  const [deleteAgent, setDeleteAgent] = useState<CustomAgent | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg mb-2">No agents yet</h3>
        <p className="text-muted-foreground">
          Create your first custom agent to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {agents.map((agent, i) => {
            const VisibilityIcon = visibilityIcons[agent.visibility];
            const isDraft = agent.status === 'draft';

            return (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={cn(
                    "group hover:shadow-md transition-all cursor-pointer",
                    isDraft && "border-dashed"
                  )}
                  onClick={() => onEdit(agent)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{agent.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <VisibilityIcon className="h-3 w-3" />
                            <span>{visibilityLabels[agent.visibility]}</span>
                            {isDraft && (
                              <Badge variant="outline" className="text-xs py-0">
                                Draft
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRun(agent); }}>
                            <Play className="h-4 w-4 mr-2" />
                            Run
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(agent); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClone(agent); }}>
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewVersions(agent); }}>
                            <History className="h-4 w-4 mr-2" />
                            Version History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(agent); }}>
                            <Share className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteAgent(agent); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {agent.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {agent.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.enabled_tools.slice(0, 3).map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-xs">
                          {tool.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {agent.enabled_tools.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{agent.enabled_tools.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(agent.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                      {agent.run_count > 0 && (
                        <span>{agent.run_count} runs</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAgent} onOpenChange={() => setDeleteAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAgent?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteAgent) {
                  onDelete(deleteAgent);
                  setDeleteAgent(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
