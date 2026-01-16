// src/components/memory/MemoryMigrationDialog.tsx
// Password-protected memory export/import for cross-origin migration

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Loader2, Shield, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { 
  exportMemoriesWithPassword, 
  importMemoriesWithPassword, 
  previewMigrationFile 
} from '@/lib/memory/migration';

interface MemoryMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function MemoryMigrationDialog({ open, onOpenChange, onComplete }: MemoryMigrationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getMasterKey } = useEncryptionContext();
  
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  
  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPreview, setImportPreview] = useState<{ count: number; exportedAt: number } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  
  // Password strength check
  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { level: 0, label: '' };
    if (password.length < 8) return { level: 1, label: t('memory.migration.passwordWeak', 'Weak') };
    if (password.length < 12) return { level: 2, label: t('memory.migration.passwordMedium', 'Medium') };
    return { level: 3, label: t('memory.migration.passwordStrong', 'Strong') };
  };
  
  const passwordStrength = getPasswordStrength(exportPassword);
  const passwordsMatch = exportPassword === exportPasswordConfirm;
  const canExport = exportPassword.length >= 8 && passwordsMatch;
  const canImport = importFile && importPassword.length >= 1;
  
  // Handle export
  const handleExport = useCallback(async () => {
    const key = getMasterKey();
    if (!key) {
      toast({ title: 'Vault locked', description: 'Please unlock your vault first', variant: 'destructive' });
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const blob = await exportMemoriesWithPassword(
        exportPassword,
        key,
        (current, total) => setExportProgress(Math.round((current / total) * 100))
      );
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swissbrain-memory-migration-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ 
        title: t('memory.migration.exportSuccess', 'Memory exported'),
        description: t('memory.migration.exportSuccessDesc', 'Your password-protected backup is ready for migration')
      });
      
      // Reset and close
      setExportPassword('');
      setExportPasswordConfirm('');
      onOpenChange(false);
    } catch (error) {
      toast({ 
        title: t('memory.migration.exportError', 'Export failed'),
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [exportPassword, getMasterKey, toast, onOpenChange, t]);
  
  // Handle file select
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    setImportResult(null);
    
    try {
      const preview = await previewMigrationFile(file);
      
      if (!preview.isPasswordProtected) {
        toast({ 
          title: t('memory.migration.legacyFile', 'Legacy export file'),
          description: t('memory.migration.legacyFileDesc', 'This file was created with the old export format. Please create a new password-protected export from the source environment.'),
          variant: 'destructive'
        });
        setImportFile(null);
        return;
      }
      
      setImportPreview({ count: preview.count, exportedAt: preview.exportedAt });
    } catch (error) {
      toast({ 
        title: t('memory.migration.invalidFile', 'Invalid file'),
        description: String(error),
        variant: 'destructive'
      });
      setImportFile(null);
    }
  }, [toast, t]);
  
  // Handle import
  const handleImport = useCallback(async () => {
    if (!importFile) return;
    
    const key = getMasterKey();
    if (!key) {
      toast({ title: 'Vault not ready', description: 'Please set up or unlock your vault first', variant: 'destructive' });
      onOpenChange(false); // Close migration dialog so user can set up vault
      return;
    }
    
    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    
    console.log('[MigrationDialog] Starting import...');
    
    // Show processing toast
    toast({ 
      title: t('memory.migration.importing', 'Importing...'),
      description: t('memory.migration.importingDesc', 'Processing {{count}} memories...', { count: importPreview?.count || 0 })
    });
    
    try {
      const result = await importMemoriesWithPassword(
        importFile,
        importPassword,
        key,
        (current, total) => setImportProgress(Math.round((current / total) * 100))
      );
      
      console.log('[MigrationDialog] Import result:', result);
      
      setImportResult(result);
      
      if (result.imported > 0) {
        toast({ 
          title: t('memory.migration.importSuccess', 'Memory imported'),
          description: t('memory.migration.importSuccessDesc', '{{count}} memories restored', { count: result.imported })
        });
      } else if (result.skipped > 0) {
        toast({ 
          title: t('memory.migration.allSkipped', 'All memories already exist'),
          description: t('memory.migration.allSkippedDesc', '{{count}} memories were already in your vault', { count: result.skipped })
        });
      } else if (result.errors.length > 0) {
        toast({ 
          title: t('memory.migration.importErrors', 'Import had errors'),
          description: result.errors[0],
          variant: 'destructive'
        });
      }
      
      onComplete?.();
      
      // Don't reset - keep showing results
    } catch (error) {
      console.error('[MigrationDialog] Import failed:', error);
      toast({ 
        title: t('memory.migration.importError', 'Import failed'),
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  }, [importFile, importPassword, importPreview, getMasterKey, toast, onComplete, t]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('memory.migration.title', 'Migrate Memory')}
          </DialogTitle>
          <DialogDescription>
            {t('memory.migration.description', 'Transfer your encrypted memories between environments with password protection.')}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'export' | 'import')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('memory.migration.export', 'Export')}
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('memory.migration.import', 'Import')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="export" className="space-y-4 mt-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>{t('memory.migration.passwordProtected', 'Password Protected')}</AlertTitle>
              <AlertDescription>
                {t('memory.migration.exportInfo', "Your memories will be decrypted and re-encrypted with your chosen password for safe transfer. You'll need this password to import on the destination.")}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="export-password">{t('memory.migration.password', 'Password')}</Label>
                <div className="relative">
                  <Input
                    id="export-password"
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder={t('memory.migration.passwordPlaceholder', 'Enter a strong password')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowExportPassword(!showExportPassword)}
                  >
                    {showExportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {exportPassword && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1 w-8 rounded ${
                            passwordStrength.level >= level
                              ? level === 1 ? 'bg-destructive' 
                              : level === 2 ? 'bg-yellow-500'
                              : 'bg-green-500'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-muted-foreground">{passwordStrength.label}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="export-password-confirm">{t('memory.migration.confirmPassword', 'Confirm Password')}</Label>
                <Input
                  id="export-password-confirm"
                  type={showExportPassword ? 'text' : 'password'}
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  placeholder={t('memory.migration.confirmPasswordPlaceholder', 'Re-enter password')}
                />
                {exportPasswordConfirm && !passwordsMatch && (
                  <p className="text-sm text-destructive">{t('memory.migration.passwordMismatch', 'Passwords do not match')}</p>
                )}
              </div>
            </div>
            
            {isExporting && (
              <div className="space-y-2">
                <Progress value={exportProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  {t('memory.migration.exporting', 'Encrypting and exporting...')} {exportProgress}%
                </p>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleExport} disabled={!canExport || isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('memory.migration.exportButton', 'Export with Password')}
              </Button>
            </DialogFooter>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4 mt-4">
            {importResult ? (
              <div className="space-y-4">
                <Alert className={importResult.errors.length > 0 ? "border-yellow-500/50 bg-yellow-500/10" : "border-green-500/50 bg-green-500/10"}>
                  {importResult.errors.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <AlertTitle>{t('memory.migration.importComplete', 'Import Complete!')}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {t('memory.migration.importResult', '{{imported}} memories imported, {{skipped}} skipped (already exist)', { 
                        imported: importResult.imported, 
                        skipped: importResult.skipped 
                      })}
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-2 text-sm">
                        <p className="font-medium text-yellow-600 dark:text-yellow-400">
                          {t('memory.migration.errorsOccurred', '{{count}} errors occurred:', { count: importResult.errors.length })}
                        </p>
                        <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto text-muted-foreground">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <li key={i} className="truncate">{err}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>...and {importResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setImportResult(null); setImportFile(null); setImportPassword(''); setImportPreview(null); }}>
                    {t('memory.migration.importAnother', 'Import Another')}
                  </Button>
                  <Button onClick={() => { setImportResult(null); onOpenChange(false); }}>
                    {t('common.done', 'Done')}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('memory.migration.selectFile', 'Migration File')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="flex-1"
                      />
                    </div>
                    {importPreview && (
                      <p className="text-sm text-muted-foreground">
                        {t('memory.migration.filePreview', '{{count}} memories, exported {{date}}', {
                          count: importPreview.count,
                          date: new Date(importPreview.exportedAt).toLocaleDateString()
                        })}
                      </p>
                    )}
                  </div>
                  
                  {importFile && (
                    <div className="space-y-2">
                      <Label htmlFor="import-password">{t('memory.migration.importPassword', 'Password')}</Label>
                      <div className="relative">
                        <Input
                          id="import-password"
                          type={showImportPassword ? 'text' : 'password'}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder={t('memory.migration.importPasswordPlaceholder', 'Enter the export password')}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowImportPassword(!showImportPassword)}
                        >
                          {showImportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-sm text-muted-foreground text-center">
                      {t('memory.migration.importing', 'Decrypting and importing...')} {importProgress}%
                    </p>
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleImport} disabled={!canImport || isImporting}>
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {t('memory.migration.importButton', 'Import')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
