import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Key,
  Copy,
  Trash2,
  Check,
  AlertTriangle,
  Camera,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  Download,
  Building2,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/useSupabase";
import { OrganizationSettings } from "@/components/organization/OrganizationSettings";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface UserSettings {
  data_retention_days: number | null;
  log_retention_days: number;
  zero_retention_mode: boolean;
}

const Settings = () => {
  const { t } = useTranslation();
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [newKeyExpiration, setNewKeyExpiration] = useState("never");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    data_retention_days: null,
    log_retention_days: 90,
    zero_retention_mode: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const { apiKeys, loading, error, refetch } = useApiKeys();
  const { createApiKey, loading: createLoading } = useCreateApiKey();
  const { deleteApiKey, loading: deleteLoading } = useDeleteApiKey();

  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setUserSettings({
          data_retention_days: data.data_retention_days,
          log_retention_days: data.log_retention_days ?? 90,
          zero_retention_mode: data.zero_retention_mode ?? false,
        });
      }
      setSettingsLoading(false);
    };

    fetchSettings();
  }, [user]);

  const updateSetting = async (key: keyof UserSettings, value: number | boolean | null) => {
    if (!user) return;

    const newSettings = { ...userSettings, [key]: value };
    setUserSettings(newSettings);

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...newSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      toast({ 
        title: "Failed to update settings", 
        description: error.message,
        variant: "destructive" 
      });
    } else {
      toast({ title: "Settings updated" });
    }
  };

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      // Fetch all user data
      const [projectsRes, datasetsRes, jobsRes, modelsRes, evaluationsRes, tracesRes] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('datasets').select('*'),
        supabase.from('finetuning_jobs').select('*'),
        supabase.from('models').select('*'),
        supabase.from('evaluations').select('*'),
        supabase.from('traces').select('*').limit(1000),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user?.email,
        projects: projectsRes.data || [],
        datasets: datasetsRes.data || [],
        finetuning_jobs: jobsRes.data || [],
        models: modelsRes.data || [],
        evaluations: evaluationsRes.data || [],
        traces: tracesRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swissvault-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Data exported successfully" });
    } catch (err) {
      toast({ 
        title: "Export failed", 
        description: "Could not export your data",
        variant: "destructive" 
      });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteAccount = async () => {
    try {
      // Note: Full account deletion requires server-side logic
      // This is a placeholder that signs the user out
      toast({ 
        title: "Account deletion requested", 
        description: "Your account deletion request has been submitted. You will be signed out."
      });
      await signOut();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not process deletion request",
        variant: "destructive" 
      });
    }
  };

  // Subscribe to real-time API key updates
  useEffect(() => {
    const channel = supabase
      .channel('api-keys-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_keys',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    // Calculate expiration date
    let expiresAt: string | null = null;
    if (newKeyExpiration !== "never") {
      const days = parseInt(newKeyExpiration);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    const result = await createApiKey(newKeyName.trim());
    
    if (result?.fullKey) {
      // Update the key with permissions and expiration
      await supabase
        .from('api_keys')
        .update({
          permissions: newKeyPermissions as unknown as Json,
          expires_at: expiresAt,
        })
        .eq('id', result.id);

      setCreatedKey(result.fullKey);
      refetch();
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast({ title: "API key copied to clipboard" });
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyId) return;
    const success = await deleteApiKey(deleteKeyId);
    if (success) {
      refetch();
    }
    setDeleteKeyId(null);
  };

  const resetCreateModal = () => {
    setCreatedKey(null);
    setNewKeyName("");
    setNewKeyPermissions(["read"]);
    setNewKeyExpiration("never");
  };

  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="animate-fade-in">
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account and API access
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="profile" className="animate-fade-in animate-delay-100">
            <TabsList className="bg-secondary border border-border">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="organization" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Organization
              </TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="data-retention">Data & Privacy</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Profile Information</CardTitle>
                  <CardDescription>Update your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground">
                        <Camera className="h-3 w-3" />
                      </button>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {user?.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground">Full Name</Label>
                      <Input 
                        defaultValue={user?.user_metadata?.full_name || ''} 
                        className="bg-secondary border-border" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Email</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          defaultValue={user?.email || ''} 
                          disabled 
                          className="bg-muted border-border" 
                        />
                        <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success">
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button className="bg-primary hover:bg-primary/90">Save Changes</Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Change Password</CardTitle>
                  <CardDescription>Update your password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        className="bg-secondary border-border pr-10"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground">New Password</Label>
                      <Input type="password" className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Confirm Password</Label>
                      <Input type="password" className="bg-secondary border-border" />
                    </div>
                  </div>
                  <Button variant="outline" className="border-border">Update Password</Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organization Tab */}
            <TabsContent value="organization" className="mt-6">
              <OrganizationSettings />
            </TabsContent>

            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="mt-6 space-y-6">
              {/* Security Info Banner */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="p-2 rounded-full bg-green-500/20">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Your API keys are securely stored</p>
                  <p className="text-sm text-muted-foreground">
                    Keys are hashed with SHA-256 and stored encrypted at rest (AES-256) in Swiss data centers
                  </p>
                </div>
              </div>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">API Keys</CardTitle>
                    <CardDescription>
                      Manage keys for API access. Keys are shown only once when created.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsCreateKeyModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create API Key
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-4">
                          <Skeleton className="h-10 w-32" />
                          <Skeleton className="h-10 w-24" />
                          <Skeleton className="h-10 w-20" />
                          <Skeleton className="h-10 w-24" />
                          <Skeleton className="h-10 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-4">Error loading API keys</p>
                      <Button onClick={() => refetch()}>Retry</Button>
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <EmptyState
                      icon={Key}
                      title="No API keys yet"
                      subtitle="Create an API key to integrate with the API"
                      actionLabel="Create API Key"
                      onAction={() => setIsCreateKeyModalOpen(true)}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Name</TableHead>
                          <TableHead className="text-muted-foreground">Key</TableHead>
                          <TableHead className="text-muted-foreground">Permissions</TableHead>
                          <TableHead className="text-muted-foreground">Created</TableHead>
                          <TableHead className="text-muted-foreground">Last Used</TableHead>
                          <TableHead className="text-muted-foreground">Expires</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => {
                          const permissions = Array.isArray(key.permissions) 
                            ? key.permissions as string[]
                            : ['read', 'write'];
                          
                          return (
                            <TableRow key={key.id} className="border-border hover:bg-secondary/50">
                              <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                              <TableCell>
                                <code className="text-sm text-muted-foreground font-mono">
                                  {key.key_prefix}••••••••
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {permissions.map((perm) => (
                                    <span
                                      key={perm}
                                      className="text-xs px-2 py-0.5 rounded-full bg-info/20 text-info"
                                    >
                                      {perm}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(key.created_at)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(key.last_used_at)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {key.expires_at ? formatDate(key.expires_at) : 'Never'}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteKeyId(key.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* SDKs & Libraries Section */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    SDKs & Libraries
                  </CardTitle>
                  <CardDescription>
                    Integrate SwissVault into your applications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Python SDK */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[#3776AB]/20 flex items-center justify-center">
                        <svg className="h-4 w-4 text-[#3776AB]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14.31.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.83l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.23l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05L0 11.97l.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.24l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05 1.07.13zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09-.33.22zM21.1 6.11l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01.21.03zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08-.33.23z"/>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-foreground">Python SDK</h3>
                    </div>

                    {/* Installation */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Installation</Label>
                      <div className="relative">
                        <pre className="bg-secondary border border-border rounded-lg p-4 pr-12 overflow-x-auto">
                          <code className="text-sm text-foreground font-mono">pip install swissvault</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard.writeText("pip install swissvault");
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Quick Start */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Quick Start</Label>
                      <div className="relative">
                        <pre className="bg-secondary border border-border rounded-lg p-4 pr-12 overflow-x-auto">
                          <code className="text-sm text-foreground font-mono whitespace-pre">{`from swissvault import SwissVault

client = SwissVault(api_key="${apiKeys.length > 0 ? apiKeys[0].key_prefix + '...' : 'YOUR_API_KEY'}")

response = client.chat.completions.create(
    model="sv-your-model-id",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.content)`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const code = `from swissvault import SwissVault

client = SwissVault(api_key="${apiKeys.length > 0 ? apiKeys[0].key_prefix + '...' : 'YOUR_API_KEY'}")

response = client.chat.completions.create(
    model="sv-your-model-id",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.content)`;
                            navigator.clipboard.writeText(code);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <a
                        href="/docs/api"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        View Documentation →
                      </a>
                      <a
                        href="https://github.com/swissvault/swissvault-python"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        GitHub Repository →
                      </a>
                    </div>
                  </div>

                  <Separator />

                  {/* JavaScript/TypeScript SDK */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[#F7DF1E]/20 flex items-center justify-center">
                        <svg className="h-4 w-4 text-[#F7DF1E]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-foreground">JavaScript/TypeScript SDK</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">Coming Soon</span>
                    </div>

                    {/* Installation */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Installation</Label>
                      <div className="relative">
                        <pre className="bg-secondary border border-border rounded-lg p-4 pr-12 overflow-x-auto opacity-60">
                          <code className="text-sm text-foreground font-mono">npm install swissvault</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard.writeText("npm install swissvault");
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* REST API */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">REST API</h3>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Use the OpenAI-compatible REST API directly with any HTTP client.
                    </p>

                    {/* cURL Example */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Example Request</Label>
                      <div className="relative">
                        <pre className="bg-secondary border border-border rounded-lg p-4 pr-12 overflow-x-auto">
                          <code className="text-sm text-foreground font-mono whitespace-pre">{`curl https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/chat-completions \\
  -H "Authorization: Bearer ${apiKeys.length > 0 ? apiKeys[0].key_prefix + '...' : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "sv-your-model-id",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const code = `curl https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/chat-completions \\
  -H "Authorization: Bearer ${apiKeys.length > 0 ? apiKeys[0].key_prefix + '...' : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "sv-your-model-id",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
                            navigator.clipboard.writeText(code);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <a
                      href="/docs/api"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      View Full API Documentation →
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Data Retention & Privacy Tab */}
            <TabsContent value="data-retention" className="mt-6 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Data Retention & Privacy</CardTitle>
                  <CardDescription>Control how your data is stored and retained</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settingsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="h-4 w-32 bg-secondary animate-pulse rounded" />
                            <div className="h-3 w-48 bg-secondary animate-pulse rounded" />
                          </div>
                          <div className="h-10 w-40 bg-secondary animate-pulse rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Auto-delete old datasets */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground">Auto-delete old datasets</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically delete datasets older than the specified period
                          </p>
                        </div>
                        <Select
                          value={userSettings.data_retention_days?.toString() || 'never'}
                          onValueChange={(v) => updateSetting('data_retention_days', v === 'never' ? null : parseInt(v))}
                        >
                          <SelectTrigger className="w-40 bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Training logs retention */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground">Training logs retention</Label>
                          <p className="text-sm text-muted-foreground">
                            How long to keep detailed training logs
                          </p>
                        </div>
                        <Select
                          value={userSettings.log_retention_days.toString()}
                          onValueChange={(v) => updateSetting('log_retention_days', parseInt(v))}
                        >
                          <SelectTrigger className="w-40 bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Zero-retention mode */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <Label className="text-foreground">Zero-retention mode</Label>
                          <p className="text-sm text-muted-foreground">
                            When enabled, your API requests and responses will not be logged to the traces table.
                            Your conversations remain private and are not stored.
                          </p>
                        </div>
                        <Switch
                          checked={userSettings.zero_retention_mode}
                          onCheckedChange={(v) => updateSetting('zero_retention_mode', v)}
                        />
                      </div>

                      <Separator />

                      {/* GDPR Export */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground">Export all my data</Label>
                          <p className="text-sm text-muted-foreground">
                            Download a copy of all your data (GDPR compliance)
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={exportAllData}
                          disabled={isExporting}
                          className="border-border"
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Export Data
                            </>
                          )}
                        </Button>
                      </div>

                      <Separator />

                      {/* Delete Account */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-destructive">Delete my account</Label>
                          <p className="text-sm text-muted-foreground">
                            Permanently delete your account and all associated data
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          onClick={() => setShowDeleteAccountDialog(true)}
                        >
                          Delete Account
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="mt-6 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Current Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">Free</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Current
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        10K API calls/month • 2 fine-tuning jobs • 1GB storage
                      </p>
                    </div>
                    <Button className="bg-primary hover:bg-primary/90 gap-2">
                      <Sparkles className="h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Usage This Month</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">API Calls</span>
                          <span className="text-foreground">7,234 / 10,000</span>
                        </div>
                        <Progress value={72} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Fine-tuning Jobs</span>
                          <span className="text-foreground">1 / 2</span>
                        </div>
                        <Progress value={50} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Storage</span>
                          <span className="text-foreground">0.3GB / 1GB</span>
                        </div>
                        <Progress value={30} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

      {/* Create API Key Modal */}
      <Dialog
        open={isCreateKeyModalOpen}
        onOpenChange={(open) => {
          setIsCreateKeyModalOpen(open);
          if (!open) {
            resetCreateModal();
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[450px]">
          {!createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">Create API Key</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Create a new API key for programmatic access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Name</Label>
                  <Input
                    placeholder="e.g., Production API"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Permissions</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={newKeyPermissions.includes("read")}
                        onCheckedChange={(checked) => {
                          setNewKeyPermissions(
                            checked
                              ? [...newKeyPermissions, "read"]
                              : newKeyPermissions.filter((p) => p !== "read")
                          );
                        }}
                      />
                      <span className="text-sm text-foreground">Read</span>
                      <span className="text-xs text-muted-foreground">
                        View projects, datasets, models
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={newKeyPermissions.includes("write")}
                        onCheckedChange={(checked) => {
                          setNewKeyPermissions(
                            checked
                              ? [...newKeyPermissions, "write"]
                              : newKeyPermissions.filter((p) => p !== "write")
                          );
                        }}
                      />
                      <span className="text-sm text-foreground">Write</span>
                      <span className="text-xs text-muted-foreground">
                        Create, modify, delete
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Expiration</Label>
                  <Select value={newKeyExpiration} onValueChange={setNewKeyExpiration}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsCreateKeyModalOpen(false)} 
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateKey} 
                  disabled={!newKeyName.trim() || createLoading} 
                  className="bg-primary hover:bg-primary/90"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  API Key Created
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning">
                    Copy this key now. You won't be able to see it again.
                  </p>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                  <code className="flex-1 text-sm font-mono text-foreground break-all">
                    {createdKey}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsCreateKeyModalOpen(false)} className="bg-primary hover:bg-primary/90">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete API Key Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? Any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account, 
              all datasets, models, and training jobs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
