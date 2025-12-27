import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

interface ExportMarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: {
    id: string;
    title: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: number;
    }>;
    createdAt?: number;
    updatedAt?: number;
  } | null;
  onExportEncrypted?: () => void;
}

export function ExportMarkdownDialog({
  open,
  onOpenChange,
  conversation,
  onExportEncrypted,
}: ExportMarkdownDialogProps) {
  if (!conversation) return null;

  const generateMarkdown = (): string => {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let markdown = `# ${conversation.title}\n\n`;
    markdown += `*Exported on ${date}*\n\n---\n\n`;

    for (const message of conversation.messages) {
      const roleLabel = message.role === 'user' ? '## 👤 User' : '## 🤖 Assistant';
      markdown += `${roleLabel}\n\n${message.content}\n\n`;
    }

    return markdown;
  };

  const handleExportMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Export Conversation
          </DialogTitle>
          <DialogDescription>
            You can export your entire conversation as markdown for easy reading and sharing, 
            or as an encrypted backup that can be re-imported.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <Button
            onClick={handleExportMarkdown}
            className="w-full justify-start gap-3"
            variant="outline"
          >
            <Download className="w-4 h-4" />
            <div className="text-left">
              <p className="font-medium">Export as Markdown</p>
              <p className="text-xs text-muted-foreground">Human-readable .md file</p>
            </div>
          </Button>

          {onExportEncrypted && (
            <Button
              onClick={() => {
                onExportEncrypted();
                onOpenChange(false);
              }}
              className="w-full justify-start gap-3"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              <div className="text-left">
                <p className="font-medium">Export Encrypted</p>
                <p className="text-xs text-muted-foreground">Secure .svghost backup file</p>
              </div>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}