import { useState } from 'react';
import { Copy, Check, Loader2, Link, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Workspace, WorkspaceRole } from '@/hooks/useWorkspaces';

interface WorkspaceInviteDialogProps {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: WorkspaceRole, message?: string) => Promise<{ invite_id: string; invite_token: string } | null>;
  onGenerateShareLink: () => Promise<string | null>;
  onRevokeShareLink: () => Promise<boolean>;
}

const roleDescriptions: Record<WorkspaceRole, string> = {
  owner: 'Full control over workspace',
  admin: 'Manage members and settings',
  editor: 'Create and edit runs',
  prompter: 'Submit prompts only',
  viewer: 'View-only access',
};

const INVITABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'prompter', 'viewer'];

export function WorkspaceInviteDialog({
  workspace,
  open,
  onOpenChange,
  onInvite,
  onGenerateShareLink,
  onRevokeShareLink,
}: WorkspaceInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const handleSendInvite = async () => {
    if (!email.trim()) return;

    setIsSending(true);
    try {
      const result = await onInvite(email.trim(), role, message.trim() || undefined);
      if (result) {
        setInviteSent(true);
        setTimeout(() => {
          setEmail('');
          setMessage('');
          setInviteSent(false);
        }, 2000);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const token = await onGenerateShareLink();
      if (token) {
        const url = `${window.location.origin}/accept-invitation?token=${token}`;
        setShareLink(url);
      }
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleRevokeLink = async () => {
    const success = await onRevokeShareLink();
    if (success) {
      setShareLink(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setEmail('');
      setRole('viewer');
      setMessage('');
      setShareLink(null);
      setInviteSent(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite to {workspace?.name}</DialogTitle>
          <DialogDescription>
            Invite team members to collaborate in this workspace.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-2">
              <Link className="h-4 w-4" />
              Share Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{r}</span>
                        <span className="text-xs text-muted-foreground">
                          - {roleDescriptions[r]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSendInvite}
              disabled={!email.trim() || isSending || inviteSent}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : inviteSent ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Invitation Sent!
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Generate a shareable link that allows anyone to join this workspace as a viewer.
              You can revoke the link at any time.
            </div>

            {shareLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <Input
                    value={shareLink}
                    readOnly
                    className="bg-transparent border-0 focus-visible:ring-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(shareLink)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(shareLink)}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRevokeLink}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={handleGenerateLink}
                disabled={isGeneratingLink}
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Generate Share Link
                  </>
                )}
              </Button>
            )}

            {workspace?.share_token && !shareLink && (
              <div className="text-sm text-muted-foreground">
                <Badge variant="outline">Active link exists</Badge>
                <span className="ml-2">
                  This workspace already has an active share link.
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
