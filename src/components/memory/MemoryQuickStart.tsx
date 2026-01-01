import { 
  Upload, 
  StickyNote, 
  MessageSquare, 
  Lightbulb,
  ArrowRight
} from '@/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface QuickStartAction {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  variant?: 'default' | 'outline';
}

interface MemoryQuickStartProps {
  onUploadDocument: () => void;
  onAddNote: () => void;
  onGoToChat: () => void;
  onViewTutorial?: () => void;
}

export function MemoryQuickStart({
  onUploadDocument,
  onAddNote,
  onGoToChat,
  onViewTutorial
}: MemoryQuickStartProps) {
  const actions: QuickStartAction[] = [
    {
      icon: <Upload className="w-5 h-5" />,
      title: 'Upload Documents',
      description: 'Add PDFs, text files, or markdown documents',
      action: onUploadDocument,
      variant: 'default'
    },
    {
      icon: <StickyNote className="w-5 h-5" />,
      title: 'Create a Note',
      description: 'Write quick notes, ideas, or snippets',
      action: onAddNote,
      variant: 'outline'
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: 'Chat with Memory',
      description: 'Enable memory in chat for smarter responses',
      action: onGoToChat,
      variant: 'outline'
    }
  ];

  const tips = [
    'Upload meeting notes to recall key decisions later',
    'Save important chat responses for future reference',
    'Add research papers and ask questions about them',
    'Create notes about projects to maintain context'
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
          <CardDescription>
            Build your AI memory with documents, notes, and chat excerpts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={action.action}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {action.icon}
                </div>
                <div className="text-center">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Tips & Ideas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Ideas for Your Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {tips.map((tip, i) => (
              <div 
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Tutorial Link */}
      {onViewTutorial && (
        <div className="text-center">
          <Button 
            variant="link" 
            size="sm" 
            onClick={onViewTutorial}
            className="text-muted-foreground"
          >
            <Lightbulb className="w-4 h-4 mr-1" />
            View Tutorial Again
          </Button>
        </div>
      )}
    </div>
  );
}
