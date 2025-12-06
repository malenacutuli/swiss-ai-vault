import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Server, 
  HardDrive, 
  Lock, 
  Download, 
  Database,
  ArrowLeft,
  Copy,
  Check,
  Cpu,
  Wifi,
  WifiOff
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-foreground">{children}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function OnPremisesDeployment() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/docs/api">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Docs
            </Button>
          </Link>
          <div className="flex-1" />
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Enterprise
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-primary/10">
            <Server className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">On-Premises Deployment</h1>
            <p className="text-muted-foreground">Deploy SwissVault.ai in your own infrastructure</p>
          </div>
        </div>
        
        <Alert className="mb-8 border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4" />
          <AlertTitle>Enterprise Feature</AlertTitle>
          <AlertDescription>
            On-premises deployment is available for Enterprise customers. 
            Contact <a href="mailto:sales@swissvault.ai" className="text-primary hover:underline">sales@swissvault.ai</a> for licensing.
          </AlertDescription>
        </Alert>

        <div className="space-y-8">
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              SwissVault can be deployed entirely within your infrastructure, 
              ensuring complete data sovereignty and air-gapped operation. This enables
              organizations with strict compliance requirements to leverage our fine-tuning
              platform while maintaining full control over their data.
            </p>
            
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">Data Sovereignty</h3>
                  <p className="text-sm text-muted-foreground">100% on-premises data storage</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <WifiOff className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">Air-Gapped</h3>
                  <p className="text-sm text-muted-foreground">No internet required</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Shield className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">Compliant</h3>
                  <p className="text-sm text-muted-foreground">GDPR, SOC 2, FINMA ready</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* System Requirements */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">System Requirements</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Component</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Minimum</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Recommended</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <Cpu className="h-4 w-4" /> CPU
                    </td>
                    <td className="py-3 px-4">8 cores</td>
                    <td className="py-3 px-4">16+ cores</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">RAM</td>
                    <td className="py-3 px-4">32 GB</td>
                    <td className="py-3 px-4">64+ GB</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">GPU</td>
                    <td className="py-3 px-4">NVIDIA A10 (24GB)</td>
                    <td className="py-3 px-4">NVIDIA A100 (40GB+)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <HardDrive className="h-4 w-4" /> Storage
                    </td>
                    <td className="py-3 px-4">500 GB SSD</td>
                    <td className="py-3 px-4">2+ TB NVMe</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">OS</td>
                    <td className="py-3 px-4" colSpan={2}>Ubuntu 22.04 LTS / RHEL 8+</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Quick Start */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Quick Start (Online)
            </h2>
            <CodeBlock language="bash">
{`# Clone deployment repository
git clone https://github.com/swissvault/swissvault-onprem.git
cd swissvault-onprem

# Copy and configure environment
cp .env.example .env
nano .env  # Edit configuration

# Pull and start services
docker-compose pull
docker-compose up -d

# Check status
docker-compose ps
curl http://localhost/health`}
            </CodeBlock>
          </section>

          {/* Air-Gapped Installation */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <WifiOff className="h-5 w-5" />
              Air-Gapped Installation
            </h2>
            <p className="text-muted-foreground mb-4">For environments without internet access:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4">
              <li>Download the offline bundle from your enterprise portal</li>
              <li>Transfer to air-gapped server via secure media</li>
              <li>Load Docker images: <code className="bg-muted px-2 py-0.5 rounded text-sm">docker load -i swissvault-images.tar</code></li>
              <li>Pre-download model weights to <code className="bg-muted px-2 py-0.5 rounded text-sm">./models/</code></li>
              <li>Start services with the air-gap compose file</li>
            </ol>
            <CodeBlock language="bash">
{`# Load pre-downloaded images
docker load -i swissvault-images.tar

# Start air-gapped deployment
docker-compose -f docker-compose.airgap.yml up -d`}
            </CodeBlock>
          </section>

          {/* Configuration */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Configuration</h2>
            <h3 className="text-lg font-medium mb-3 text-foreground">Environment Variables</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Variable</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Required</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-3 px-4"><code className="bg-muted px-2 py-0.5 rounded text-sm">POSTGRES_PASSWORD</code></td>
                    <td className="py-3 px-4">Database password</td>
                    <td className="py-3 px-4"><Badge className="bg-red-500/10 text-red-500">Yes</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4"><code className="bg-muted px-2 py-0.5 rounded text-sm">JWT_SECRET</code></td>
                    <td className="py-3 px-4">JWT signing secret (32+ chars)</td>
                    <td className="py-3 px-4"><Badge className="bg-red-500/10 text-red-500">Yes</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4"><code className="bg-muted px-2 py-0.5 rounded text-sm">HF_TOKEN</code></td>
                    <td className="py-3 px-4">HuggingFace token (for model download)</td>
                    <td className="py-3 px-4"><Badge variant="outline">Online only</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4"><code className="bg-muted px-2 py-0.5 rounded text-sm">ANTHROPIC_API_KEY</code></td>
                    <td className="py-3 px-4">Claude API key (optional)</td>
                    <td className="py-3 px-4"><Badge variant="outline">No</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Model Management */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Download className="h-5 w-5" />
              Model Management
            </h2>
            <p className="text-muted-foreground mb-4">Pre-load models for air-gapped operation:</p>
            <CodeBlock language="bash">
{`# Download models (on internet-connected machine)
python scripts/download_models.py --models qwen2.5-3b,mistral-7b

# Copy to air-gapped server
scp -r ./models/ user@airgap-server:/opt/swissvault/models/

# Configure model path in .env
MODEL_PATH=/opt/swissvault/models`}
            </CodeBlock>
          </section>

          {/* Backup & Recovery */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup & Recovery
            </h2>
            <CodeBlock language="bash">
{`# Backup database
docker exec swissvault-db pg_dump -U postgres swissvault > backup.sql

# Backup storage
tar -czf storage_backup.tar.gz ./volumes/storage/

# Restore
docker exec -i swissvault-db psql -U postgres swissvault < backup.sql`}
            </CodeBlock>
          </section>

          {/* Security Hardening */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Hardening
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                Enable TLS with your organization's certificates
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                Configure firewall to restrict access
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                Set up log forwarding to your SIEM
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                Enable audit logging
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                Rotate secrets regularly
              </li>
            </ul>
          </section>

          {/* Support */}
          <section>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Enterprise Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Enterprise customers receive dedicated support. Contact your account 
                  manager or email our enterprise support team.
                </p>
                <div className="flex gap-3">
                  <Button asChild>
                    <a href="mailto:enterprise-support@swissvault.ai">
                      Contact Support
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="mailto:sales@swissvault.ai">
                      Talk to Sales
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}