import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Lock, Download, Upload, FileArchive, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  exportGhostConversations,
  importGhostConversations,
  type ExportableConversation,
} from '@/lib/ghost/export-import';

interface ExportImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Array<{ id: string; title: string; updatedAt: number }>;
  getConversation: (id: string) => ExportableConversation | undefined;
  onImportComplete: (conversations: ExportableConversation[]) => void;
  defaultTab?: 'export' | 'import';
}

export function ExportImportDialog({
  open,
  onOpenChange,
  conversations,
  getConversation,
  onImportComplete,
  defaultTab = 'export',
}: ExportImportDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Import state
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewStats, setPreviewStats] = useState<{ total: number; messages: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.name.endsWith('.svghost')) {
      setSelectedFile(file);
      setPreviewStats(null);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a .svghost file',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.svghost'],
    },
    maxFiles: 1,
  });

  const handleExport = async () => {
    if (exportPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    if (exportPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      // Get full conversation data
      const fullConversations: ExportableConversation[] = [];
      for (const conv of conversations) {
        const full = getConversation(conv.id);
        if (full) {
          fullConversations.push(full);
        }
      }

      const blob = await exportGhostConversations(fullConversations, exportPassword);
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `ghost-backup-${date}.svghost`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${fullConversations.length} conversations`,
      });

      // Reset and close
      setExportPassword('');
      setConfirmPassword('');
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export conversations',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a .svghost file to import',
        variant: 'destructive',
      });
      return;
    }

    if (importPassword.length < 8) {
      toast({
        title: 'Password required',
        description: 'Please enter the password used to encrypt this file',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const result = await importGhostConversations(selectedFile, importPassword);
      
      setPreviewStats(result.stats);
      onImportComplete(result.conversations);

      toast({
        title: 'Import successful',
        description: `Imported ${result.stats.total} conversations with ${result.stats.messages} messages`,
      });

      // Reset and close
      setSelectedFile(null);
      setImportPassword('');
      setPreviewStats(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import conversations',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setExportPassword('');
    setConfirmPassword('');
    setImportPassword('');
    setSelectedFile(null);
    setPreviewStats(null);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(value) => {
        if (!value) resetState();
        onOpenChange(value);
      }}
    >
      <DialogContent className="bg-slate-900 border-purple-500/30 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-400" />
            Export / Import Ghost Sessions
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Securely backup or restore your encrypted conversations
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'export' | 'import')}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger 
              value="export" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger 
              value="import"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <FileArchive className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-white font-medium">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Will be encrypted and saved as .svghost
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="export-password" className="text-white">
                  Encryption Password
                </Label>
                <div className="relative">
                  <Input
                    id="export-password"
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="bg-slate-800 border-purple-500/30 text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassword(!showExportPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  >
                    {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showExportPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="bg-slate-800 border-purple-500/30 text-white"
                  />
                  {confirmPassword && exportPassword === confirmPassword && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300">
                  Remember this password! Without it, your backup cannot be restored.
                </p>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || exportPassword.length < 8 || exportPassword !== confirmPassword || conversations.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download .svghost
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : selectedFile
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5'
              }`}
            >
              <input {...getInputProps()} />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileArchive className="w-8 h-8 text-green-400" />
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-purple-400" />
                  <p className="text-white">
                    {isDragActive ? 'Drop file here' : 'Drop .svghost file or click to browse'}
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="import-password" className="text-white">
                    Decryption Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="import-password"
                      type={showImportPassword ? 'text' : 'password'}
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder="Enter the password used to encrypt this file"
                      className="bg-slate-800 border-purple-500/30 text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImportPassword(!showImportPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Imported conversations will be merged with your existing sessions.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleImport}
                  disabled={isImporting || importPassword.length < 8}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isImporting ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Decrypting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
