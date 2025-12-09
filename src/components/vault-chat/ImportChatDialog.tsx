import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileJson, AlertTriangle, CheckCircle2, Lock, Calendar, MessageSquare } from 'lucide-react';
import { localChatStorage, type ExportedChat, type LocalConversation } from '@/lib/storage/local-chat-storage';
import { chatEncryption } from '@/lib/encryption';
import { toast } from 'sonner';

interface ImportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (conversationId: string) => void;
}

type ImportStep = 'select' | 'preview' | 'importing';

interface ParsedImport {
  data: ExportedChat;
  existingConversation: LocalConversation | null;
}

export function ImportChatDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ImportChatDialogProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('select');
    setParsedImport(null);
    setError(null);
    setIsProcessing(false);
    setReplaceExisting(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      // Read file contents
      const text = await file.text();
      let data: ExportedChat;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON file format');
      }

      // Validate structure
      if (data.version !== '1.0') {
        throw new Error(`Unsupported export version: ${data.version}`);
      }

      if (!data.conversation || !data.messages || !data.wrapped_key) {
        throw new Error('Invalid export file: missing required fields');
      }

      if (data.encryption?.algorithm !== 'AES-256-GCM') {
        throw new Error('Invalid encryption algorithm');
      }

      // Check if conversation already exists
      await localChatStorage.init();
      const existingConversation = await localChatStorage.getConversation(data.conversation.id);

      setParsedImport({ data, existingConversation });
      setStep('preview');

    } catch (err) {
      console.error('[ImportChatDialog] Parse error:', err);
      setError((err as Error).message || 'Failed to parse import file');
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!parsedImport) return;

    if (parsedImport.existingConversation && !replaceExisting) {
      toast.error('Please choose to replace or cancel');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStep('importing');

    try {
      const { data, existingConversation } = parsedImport;

      // If replacing, delete existing conversation first
      if (existingConversation && replaceExisting) {
        await localChatStorage.deleteConversation(existingConversation.id);
        await chatEncryption.deleteKey(existingConversation.id);
        console.log('[ImportChatDialog] Deleted existing conversation:', existingConversation.id);
      }

      // Import using localChatStorage
      const conversationId = await localChatStorage.importConversation(data);

      // Import the key from the wrapped_key in the export
      // The key was stored as base64 in the export
      try {
        const keyBytes = atob(data.wrapped_key.ciphertext);
        const keyArray = new Uint8Array(keyBytes.length);
        for (let i = 0; i < keyBytes.length; i++) {
          keyArray[i] = keyBytes.charCodeAt(i);
        }
        
        // Import as CryptoKey
        const key = await crypto.subtle.importKey(
          'raw',
          keyArray.buffer,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // Store in IndexedDB
        await chatEncryption.storeKey(conversationId, key);
        console.log('[ImportChatDialog] Stored conversation key');
      } catch (keyErr) {
        console.warn('[ImportChatDialog] Key storage warning:', keyErr);
        // Key storage failed, but conversation is imported
      }

      toast.success('Chat imported successfully');
      onImportSuccess(conversationId);
      handleClose();

    } catch (err) {
      console.error('[ImportChatDialog] Import error:', err);
      setError((err as Error).message || 'Failed to import chat');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import ZeroTrace Chat
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select an exported chat file to import.'}
            {step === 'preview' && 'Review the chat before importing.'}
            {step === 'importing' && 'Importing chat...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: File Selection */}
          {step === 'select' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileJson className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to select a .json export file
                </p>
                <p className="text-xs text-muted-foreground">
                  ZeroTrace export files only
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {isProcessing && (
                <p className="text-sm text-center text-muted-foreground">
                  Reading file...
                </p>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && parsedImport && (
            <div className="space-y-4">
              {/* Chat Info */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Encrypted Conversation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  <span>{parsedImport.data.messages.length} messages</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Exported: {formatDate(parsedImport.data.exported_at)}</span>
                </div>
              </div>

              {/* Duplicate Warning */}
              {parsedImport.existingConversation && (
                <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-200">
                    <p className="font-medium mb-2">This conversation already exists locally.</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                        className="rounded border-amber-500"
                      />
                      <span>Replace existing conversation</span>
                    </label>
                  </AlertDescription>
                </Alert>
              )}

              {/* Encryption Info */}
              <div className="text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
                Encryption: {parsedImport.data.encryption.algorithm}
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="text-center py-4">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Importing...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>

          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={(parsedImport?.existingConversation && !replaceExisting) || isProcessing}
            >
              Import Chat
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}