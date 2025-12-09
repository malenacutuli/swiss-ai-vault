import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertTriangle, FileJson, Lock } from 'lucide-react';
import { localChatStorage, type ExportedChat } from '@/lib/storage/local-chat-storage';
import { toast } from 'sonner';

interface ExportMessage {
  role: string;
  content: string;
  created_at?: string;
}

interface ExportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationTitle: string;
  messageCount: number;
  wrappedKey?: {
    ciphertext: string;
    nonce: string;
  };
  messages?: ExportMessage[];
  isZeroTrace?: boolean;
  onExportComplete?: () => void;
}

export function ExportChatDialog({
  open,
  onOpenChange,
  conversationId,
  conversationTitle,
  messageCount,
  wrappedKey,
  messages,
  isZeroTrace = false,
  onExportComplete,
}: ExportChatDialogProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let exportedData;
      
      if (isZeroTrace && wrappedKey) {
        // ZeroTrace mode: Export from IndexedDB with wrapped key
        exportedData = await localChatStorage.exportConversation(conversationId, wrappedKey);
      } else if (messages) {
        // Cloud mode: Export provided messages directly
        exportedData = {
          version: '1.0',
          exported_at: new Date().toISOString(),
          storage_mode: 'cloud',
          conversation: {
            id: conversationId,
            title: conversationTitle,
            message_count: messageCount,
          },
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at || new Date().toISOString(),
          })),
        };
      } else {
        throw new Error('No data available for export');
      }
      
      // Create blob and trigger download
      const blob = new Blob([JSON.stringify(exportedData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      const safeName = conversationTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      const prefix = isZeroTrace ? 'zerotrace' : 'vaultchat';
      a.download = `${prefix}_${safeName}_${date}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Chat exported successfully');
      onExportComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('[ExportChatDialog] Export failed:', error);
      toast.error('Failed to export chat');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            Export ZeroTrace Chat
          </DialogTitle>
          <DialogDescription>
            Export this encrypted conversation to a backup file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Conversation Info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{conversationTitle}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {messageCount} encrypted message{messageCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Export Details */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>The export will include:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5">
              <li>Encrypted conversation metadata</li>
              <li>All encrypted messages</li>
              <li>Wrapped encryption key</li>
            </ul>
          </div>

          {/* Security Warning */}
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-200">
              <strong>This is your only backup.</strong> Store it securely. 
              You'll need your vault password to import it later.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export to File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}