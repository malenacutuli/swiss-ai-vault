import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
}

const mockApiKeys: ApiKey[] = [
  {
    id: "1",
    name: "Production API",
    prefix: "sv_prod_",
    permissions: ["read", "write"],
    createdAt: "2024-01-15",
    lastUsed: "2024-01-23",
  },
  {
    id: "2",
    name: "Development",
    prefix: "sv_dev_",
    permissions: ["read"],
    createdAt: "2024-01-20",
  },
];

const Settings = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [newKeyExpiration, setNewKeyExpiration] = useState("never");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCreateKey = () => {
    // Simulate key creation
    const fakeKey = `sv_${newKeyExpiration === "never" ? "prod" : "temp"}_${Math.random().toString(36).substring(2, 15)}`;
    setCreatedKey(fakeKey);
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast({ title: "API key copied to clipboard" });
    }
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
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          JD
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground">
                        <Camera className="h-3 w-3" />
                      </button>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">John Doe</p>
                      <p className="text-sm text-muted-foreground">john@company.com</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground">Full Name</Label>
                      <Input defaultValue="John Doe" className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Email</Label>
                      <div className="flex items-center gap-2">
                        <Input defaultValue="john@company.com" disabled className="bg-muted border-border" />
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
                  {mockApiKeys.length === 0 ? (
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
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockApiKeys.map((key) => (
                          <TableRow key={key.id} className="border-border hover:bg-secondary/50">
                            <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                            <TableCell>
                              <code className="text-sm text-muted-foreground font-mono">
                                {key.prefix}****
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {key.permissions.map((perm) => (
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
                              {formatDate(key.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {key.lastUsed ? formatDate(key.lastUsed) : "Never"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
            setCreatedKey(null);
            setNewKeyName("");
            setNewKeyPermissions(["read"]);
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
                <Button variant="ghost" onClick={() => setIsCreateKeyModalOpen(false)} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={!newKeyName} className="bg-primary hover:bg-primary/90">
                  Create
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
    </div>
  );
};

export default Settings;
