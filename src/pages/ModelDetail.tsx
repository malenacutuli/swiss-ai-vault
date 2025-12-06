import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Cpu,
  ArrowLeft,
  Rocket,
  CheckCircle,
  Copy,
  MessageSquare,
  Loader2,
  CloudOff,
  ExternalLink,
  Download,
  Calendar,
  Hash,
  Layers,
} from "lucide-react";

interface Model {
  id: string;
  name: string;
  model_id: string;
  base_model: string;
  description: string | null;
  parameter_count: number | null;
  context_length: number | null;
  is_deployed: boolean | null;
  s3_checkpoint_path: string | null;
  s3_gguf_path: string | null;
  finetuning_job_id: string | null;
  created_at: string | null;
}

type DeploymentStatus = 'not_deployed' | 'deploying' | 'deployed' | 'undeploying';

const ModelDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>('not_deployed');
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    const fetchModel = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        toast({ title: "Error loading model", variant: "destructive" });
        navigate('/dashboard/models');
        return;
      }
      
      setModel(data);
      setDeploymentStatus(data.is_deployed ? 'deployed' : 'not_deployed');
      setLoading(false);
    };

    fetchModel();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`model-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'models',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setModel(payload.new as Model);
          setDeploymentStatus((payload.new as Model).is_deployed ? 'deployed' : 'not_deployed');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate, toast]);

  const deployModel = async () => {
    if (!model) return;
    
    setIsDeploying(true);
    setDeploymentStatus('deploying');
    
    try {
      // Update model to deployed status
      const { error } = await supabase
        .from('models')
        .update({ is_deployed: true })
        .eq('id', model.id);
      
      if (error) throw error;
      
      // Simulate deployment time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setDeploymentStatus('deployed');
      toast({ title: "Model deployed successfully" });
    } catch (err) {
      setDeploymentStatus('not_deployed');
      toast({ 
        title: "Deployment failed", 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const undeployModel = async () => {
    if (!model) return;
    
    setDeploymentStatus('undeploying');
    
    try {
      const { error } = await supabase
        .from('models')
        .update({ is_deployed: false })
        .eq('id', model.id);
      
      if (error) throw error;
      
      setDeploymentStatus('not_deployed');
      toast({ title: "Model undeployed" });
    } catch (err) {
      setDeploymentStatus('deployed');
      toast({ 
        title: "Failed to undeploy", 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatParameterCount = (count: number | null) => {
    if (!count) return 'Unknown';
    if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
    if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
    return count.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6 space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-96" />
              </div>
              <Skeleton className="h-80" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!model) {
    return null;
  }

  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`;

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="p-6 space-y-6">
          {/* Back Button & Header */}
          <div className="animate-fade-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/models')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Models
            </Button>
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Cpu className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{model.name}</h1>
                  <p className="text-muted-foreground">{model.base_model}</p>
                </div>
              </div>
              <Badge variant={deploymentStatus === 'deployed' ? 'default' : 'secondary'}>
                {deploymentStatus === 'deployed' ? 'Deployed' : 'Not Deployed'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 animate-fade-in animate-delay-100">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Model Info */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Model Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {model.description && (
                    <p className="text-muted-foreground">{model.description}</p>
                  )}
                  
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 rounded-lg bg-secondary">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Hash className="h-4 w-4" />
                        <span className="text-sm">Model ID</span>
                      </div>
                      <code className="text-sm font-mono text-foreground">{model.model_id}</code>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-secondary">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Layers className="h-4 w-4" />
                        <span className="text-sm">Parameters</span>
                      </div>
                      <p className="text-foreground font-medium">
                        {formatParameterCount(model.parameter_count)}
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-secondary">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">Created</span>
                      </div>
                      <p className="text-foreground font-medium">
                        {formatDate(model.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {model.context_length && (
                    <div className="text-sm text-muted-foreground">
                      Context Length: {(model.context_length / 1000).toFixed(0)}K tokens
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* API Usage Examples */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">API Usage</CardTitle>
                  <CardDescription>
                    Use your deployed model via the API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="python">
                    <TabsList className="bg-secondary">
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                      <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="python" className="mt-4">
                      <div className="relative">
                        <pre className="bg-[#1e1e2e] text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{`import requests

response = requests.post(
    "${apiEndpoint}",
    headers={
        "Authorization": "Bearer sv_...",
        "Content-Type": "application/json"
    },
    json={
        "model": "${model.model_id}",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => copyToClipboard(`import requests

response = requests.post(
    "${apiEndpoint}",
    headers={
        "Authorization": "Bearer sv_...",
        "Content-Type": "application/json"
    },
    json={
        "model": "${model.model_id}",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])`, 'Code')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="curl" className="mt-4">
                      <div className="relative">
                        <pre className="bg-[#1e1e2e] text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{`curl -X POST ${apiEndpoint} \\
  -H "Authorization: Bearer sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.model_id}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => copyToClipboard(`curl -X POST ${apiEndpoint} \\
  -H "Authorization: Bearer sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.model_id}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`, 'Code')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="javascript" className="mt-4">
                      <div className="relative">
                        <pre className="bg-[#1e1e2e] text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{`const response = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sv_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: '${model.model_id}',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => copyToClipboard(`const response = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sv_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: '${model.model_id}',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`, 'Code')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Deployment Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Deployment</CardTitle>
                  <CardDescription>
                    Deploy this model for inference via API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deploymentStatus === 'not_deployed' && (
                    <div className="text-center py-6">
                      <CloudOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-medium text-foreground mb-2">Model not deployed</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Deploy this model to use it via API or in the Playground
                      </p>
                      <Button onClick={deployModel} disabled={isDeploying} className="w-full">
                        {isDeploying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deploying...
                          </>
                        ) : (
                          <>
                            <Rocket className="mr-2 h-4 w-4" />
                            Deploy Model
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {deploymentStatus === 'deploying' && (
                    <div className="text-center py-6">
                      <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                      <h3 className="font-medium text-foreground mb-2">Deploying...</h3>
                      <p className="text-sm text-muted-foreground">
                        This usually takes 2-5 minutes
                      </p>
                    </div>
                  )}

                  {deploymentStatus === 'deployed' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Model Deployed</span>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-secondary">
                        <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-xs font-mono text-foreground truncate">
                            POST /v1/chat/completions
                          </code>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(apiEndpoint, 'Endpoint')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-secondary">
                        <Label className="text-xs text-muted-foreground">Model ID</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-xs font-mono text-foreground truncate">
                            {model.model_id}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(model.model_id, 'Model ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" asChild className="w-full">
                          <Link to={`/dashboard/playground?model=${model.model_id}`}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Test in Playground
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="w-full text-destructive hover:text-destructive" 
                          onClick={undeployModel}
                        >
                          Undeploy
                        </Button>
                      </div>
                    </div>
                  )}

                  {deploymentStatus === 'undeploying' && (
                    <div className="text-center py-6">
                      <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                      <h3 className="font-medium text-foreground mb-2">Undeploying...</h3>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.finetuning_job_id && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => navigate(`/dashboard/finetuning?job=${model.finetuning_job_id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Fine-tuning Job
                    </Button>
                  )}
                  {model.s3_checkpoint_path && (
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="mr-2 h-4 w-4" />
                      Download Checkpoint
                    </Button>
                  )}
                  {model.s3_gguf_path && (
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="mr-2 h-4 w-4" />
                      Download GGUF
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ModelDetail;
