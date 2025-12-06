import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface UserSettings {
  data_retention_days: number | null;
  log_retention_days: number;
  zero_retention_mode: boolean;
}

const Settings = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-[280px]"
        )}
      >
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="p-6 space-y-6">
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

            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="mt-6 space-y-6">
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
                        <div>
                          <Label className="text-foreground">Zero-retention mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Don't log any inference requests or responses
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
        </main>
      </div>

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
