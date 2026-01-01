import { useState, useEffect } from 'react';
import {
  Share2, Link, Mail, Users, Globe, Lock, Copy, Check, X,
  Clock, Shield, Loader2, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  shareSession, createShareLink, getWorkspaces,
  type SharePermission, type TeamWorkspace, type ShareLink
} from '@/lib/collaboration/team-workspace';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'session' | 'source';
  itemId: string;
  itemTitle: string;
  currentUserId: string;
  onShared?: () => void;
}

export function ShareDialog({
  open, onOpenChange, itemType, itemId, itemTitle, currentUserId, onShared
}: ShareDialogProps) {
  const { toast } = useToast();
  
  const [tab, setTab] = useState<'people' | 'link' | 'workspace'>('people');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [permission, setPermission] = useState<SharePermission>('view');
  const [message, setMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [linkRequiresEmail, setLinkRequiresEmail] = useState(false);
  const [linkMaxAccesses, setLinkMaxAccesses] = useState<number | undefined>(undefined);
  const [linkAllowedDomains, setLinkAllowedDomains] = useState<string>('');
  
  useEffect(() => {
    setWorkspaces(getWorkspaces());
  }, [open]);
  
  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setEmailInput('');
    }
  };
  
  const handleRemoveEmail = (email: string) => {
    setRecipients(recipients.filter(e => e !== email));
  };
  
  const handleShareWithPeople = async () => {
    if (recipients.length === 0) {
      toast({ title: 'No recipients', description: 'Add at least one email address', variant: 'destructive' });
      return;
    }
    
    setIsSharing(true);
    try {
      shareSession(itemId, currentUserId, {
        scope: 'private',
        permission,
        recipients,
        expiresInDays,
        message: message || undefined
      });
      toast({ title: 'Shared successfully', description: `Invitation sent to ${recipients.length} people` });
      onShared?.();
      onOpenChange(false);
    } catch {
      toast({ title: 'Share failed', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleCreateLink = async () => {
    setIsSharing(true);
    try {
      const allowedDomains = linkAllowedDomains.split(',').map(d => d.trim()).filter(d => d.length > 0);
      const link = createShareLink(itemType, itemId, currentUserId, {
        permission: permission as 'view' | 'comment',
        expiresInDays,
        maxAccesses: linkMaxAccesses,
        requiresEmail: linkRequiresEmail,
        allowedDomains: allowedDomains.length > 0 ? allowedDomains : undefined
      });
      setShareLink(link);
      toast({ title: 'Link created', description: 'Share link is ready to copy' });
    } catch {
      toast({ title: 'Failed to create link', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleCopyLink = async () => {
    if (!shareLink) return;
    const url = `${window.location.origin}/shared/${shareLink.type}/${shareLink.accessCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: 'Link copied!' });
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };
  
  const handleShareToWorkspace = async () => {
    if (!selectedWorkspace) {
      toast({ title: 'Select a workspace', variant: 'destructive' });
      return;
    }
    setIsSharing(true);
    try {
      shareSession(itemId, currentUserId, { scope: 'workspace', permission, workspaceId: selectedWorkspace });
      const workspace = workspaces.find(w => w.id === selectedWorkspace);
      toast({ title: 'Shared to workspace', description: `Now available to ${workspace?.members.length} members` });
      onShared?.();
      onOpenChange(false);
    } catch {
      toast({ title: 'Share failed', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Research
          </DialogTitle>
          <DialogDescription>Share "{itemTitle}" with your team or via link</DialogDescription>
        </DialogHeader>
        
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="people" className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />People
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-1.5">
              <Link className="h-4 w-4" />Link
            </TabsTrigger>
            <TabsTrigger value="workspace" className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />Workspace
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="people" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Invite by email</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="colleague@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                />
                <Button variant="outline" onClick={handleAddEmail}>Add</Button>
              </div>
            </div>
            
            {recipients.length > 0 && (
              <div className="space-y-2">
                <Label>Recipients</Label>
                <div className="flex flex-wrap gap-2">
                  {recipients.map(email => (
                    <div key={email} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">{email[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{email}</span>
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleRemoveEmail(email)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Permission level</Label>
              <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view"><div className="flex items-center gap-2"><Lock className="h-4 w-4" />View only</div></SelectItem>
                  <SelectItem value="comment"><div className="flex items-center gap-2"><Users className="h-4 w-4" />Can comment</div></SelectItem>
                  <SelectItem value="edit"><div className="flex items-center gap-2"><Globe className="h-4 w-4" />Can edit</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Access expires</Label>
              <Select value={expiresInDays?.toString() || 'never'} onValueChange={(v) => setExpiresInDays(v === 'never' ? undefined : parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea placeholder="Add a note for recipients..." value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            </div>
            
            <Button className="w-full" onClick={handleShareWithPeople} disabled={isSharing || recipients.length === 0}>
              {isSharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Invitation{recipients.length > 1 ? 's' : ''}
            </Button>
          </TabsContent>
          
          <TabsContent value="link" className="space-y-4 mt-4">
            {!shareLink ? (
              <>
                <div className="space-y-2">
                  <Label>Anyone with the link can</Label>
                  <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View only</SelectItem>
                      <SelectItem value="comment">View & comment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Link expires</Label>
                  <Select value={expiresInDays?.toString() || 'never'} onValueChange={(v) => setExpiresInDays(v === 'never' ? undefined : parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">Security options</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Require email to view</Label>
                    <Switch checked={linkRequiresEmail} onCheckedChange={setLinkRequiresEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-normal">Max accesses (optional)</Label>
                    <Input type="number" placeholder="Unlimited" value={linkMaxAccesses || ''} onChange={(e) => setLinkMaxAccesses(e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-normal">Restrict to domains (optional)</Label>
                    <Input placeholder="company.com, partner.org" value={linkAllowedDomains} onChange={(e) => setLinkAllowedDomains(e.target.value)} />
                  </div>
                </div>
                
                <Button className="w-full" onClick={handleCreateLink} disabled={isSharing}>
                  {isSharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link className="h-4 w-4 mr-2" />}
                  Create Shareable Link
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-medium">Link Ready!</h3>
                  <p className="text-sm text-muted-foreground">Share this link with anyone</p>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/shared/${shareLink.type}/${shareLink.accessCode}`} className="font-mono text-xs" />
                  <Button onClick={handleCopyLink}>{linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /><span>Permission: {shareLink.permission}</span></div>
                  {shareLink.expiresAt && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>Expires: {new Date(shareLink.expiresAt).toLocaleDateString()}</span></div>}
                  {shareLink.maxAccesses && <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span>Max accesses: {shareLink.maxAccesses}</span></div>}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setShareLink(null)}>Create New Link</Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="workspace" className="space-y-4 mt-4">
            {workspaces.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium mb-1">No Workspaces</h3>
                <p className="text-sm text-muted-foreground mb-4">Create a workspace to share with your team</p>
                <Button variant="outline">Create Workspace</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select workspace</Label>
                  <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                    <SelectTrigger><SelectValue placeholder="Choose a workspace" /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map(workspace => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{workspace.name}</span>
                            <Badge variant="outline" className="text-xs ml-2">{workspace.members.length} members</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedWorkspace && (
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Workspace members will have access:</p>
                    <div className="flex flex-wrap gap-1">
                      {workspaces.find(w => w.id === selectedWorkspace)?.members.slice(0, 5).map(member => (
                        <Badge key={member.id} variant="secondary" className="text-xs">{member.name}</Badge>
                      ))}
                      {(workspaces.find(w => w.id === selectedWorkspace)?.members.length || 0) > 5 && (
                        <Badge variant="secondary" className="text-xs">+{(workspaces.find(w => w.id === selectedWorkspace)?.members.length || 0) - 5} more</Badge>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Permission level</Label>
                  <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View only</SelectItem>
                      <SelectItem value="comment">View & comment</SelectItem>
                      <SelectItem value="edit">Full edit access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button className="w-full" onClick={handleShareToWorkspace} disabled={isSharing || !selectedWorkspace}>
                  {isSharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                  Share to Workspace
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-4">
          <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">End-to-end encrypted</p>
            <p>Shared content remains encrypted. Recipients must have a SwissVault account to access.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
