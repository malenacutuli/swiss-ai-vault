import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  AlertTriangle,
  Check,
  Clock,
  Ban,
} from '@/icons';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_minute: number;
  monthly_credit_limit: number | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  total_requests: number;
}

interface NewKeyForm {
  name: string;
  permissions: string[];
  rate_limit: number;
  monthly_limit: string;
  expires_days: string;
}

const DEFAULT_FORM: NewKeyForm = {
  name: '',
  permissions: ['text', 'image', 'video'],
  rate_limit: 60,
  monthly_limit: '',
  expires_days: '',
};

export function GhostAPIKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [newKeySecret, setNewKeySecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<NewKeyForm>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('ghost_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    if (!user || !form.name.trim()) return;
    
    setCreating(true);
    try {
      // Generate a secure random key
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const rawKey = `ghost_${Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      const keyPrefix = rawKey.slice(0, 12);
      
      // Hash the key for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const expiresAt = form.expires_days
        ? new Date(Date.now() + parseInt(form.expires_days) * 24 * 60 * 60 * 1000).toISOString()
        : null;
      
      const { error } = await supabase
        .from('ghost_api_keys')
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          key_hash: keyHash,
          key_prefix: keyPrefix,
          permissions: form.permissions,
          rate_limit_per_minute: form.rate_limit,
          monthly_credit_limit: form.monthly_limit ? parseInt(form.monthly_limit) : null,
          expires_at: expiresAt,
        });

      if (error) throw error;
      
      setNewKeySecret(rawKey);
      setShowNewKeyDialog(false);
      setShowSecretDialog(true);
      setForm(DEFAULT_FORM);
      fetchKeys();
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('ghost_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;
      
      toast.success('API key revoked');
      setShowRevokeDialog(null);
      fetchKeys();
    } catch (error) {
      console.error('Failed to revoke key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const deleteKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('ghost_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
      
      toast.success('API key deleted');
      setShowDeleteDialog(null);
      fetchKeys();
    } catch (error) {
      console.error('Failed to delete key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const togglePermission = (permission: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">API Keys</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage API keys for programmatic access
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewKeyDialog(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Generate Key
        </Button>
      </div>

      {/* Keys List */}
      <ScrollArea className="h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Key className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No API keys yet</p>
            <p className="text-xs">Create one to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className={cn(
                  'p-4 rounded-lg border bg-card/50',
                  !key.is_active && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{key.name}</span>
                      <Badge 
                        variant={key.is_active ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5"
                      >
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono mt-1 block">
                      {key.key_prefix}...
                    </code>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {format(new Date(key.created_at), 'MMM d, yyyy')}
                      </span>
                      {key.last_used_at && (
                        <span>
                          Last used {format(new Date(key.last_used_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      <span>{key.total_requests.toLocaleString()} requests</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {key.permissions.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px]">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-warning"
                        onClick={() => setShowRevokeDialog(key.id)}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setShowDeleteDialog(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* New Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access to Ghost AI
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My API Key"
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="flex gap-4">
                {['text', 'image', 'video'].map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.permissions.includes(p)}
                      onCheckedChange={() => togglePermission(p)}
                    />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate Limit (req/min)</Label>
                <Input
                  type="number"
                  value={form.rate_limit}
                  onChange={(e) => setForm({ ...form, rate_limit: parseInt(e.target.value) || 60 })}
                  min={1}
                  max={1000}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Credit Limit</Label>
                <Input
                  type="number"
                  value={form.monthly_limit}
                  onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expires In (days)</Label>
              <Input
                type="number"
                value={form.expires_days}
                onChange={(e) => setForm({ ...form, expires_days: e.target.value })}
                placeholder="Never"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={generateKey} 
              disabled={!form.name.trim() || form.permissions.length === 0 || creating}
            >
              {creating ? 'Creating...' : 'Generate Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Display Dialog */}
      <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This key will only be shown once. Copy and store it securely.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-3 rounded-lg bg-muted font-mono text-sm break-all border">
              {newKeySecret}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => copyToClipboard(newKeySecret)}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setShowSecretDialog(false);
              setNewKeySecret('');
            }}>
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!showRevokeDialog} onOpenChange={() => setShowRevokeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the API key. Any applications using it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showRevokeDialog && revokeKey(showRevokeDialog)}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The key will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteKey(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
