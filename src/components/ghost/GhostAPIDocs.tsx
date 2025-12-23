import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-api`;

interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="relative group">
      <pre className="p-4 rounded-lg bg-muted/50 border overflow-x-auto text-xs">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

interface EndpointProps {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  children: React.ReactNode;
}

function Endpoint({ method, path, description, children }: EndpointProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-3">
          <Badge 
            variant={method === 'POST' ? 'default' : 'secondary'}
            className={cn(
              'font-mono text-xs',
              method === 'POST' && 'bg-blue-600'
            )}
          >
            {method}
          </Badge>
          <code className="text-sm font-mono">{path}</code>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

export function GhostAPIDocs() {
  const pythonExample = `import requests

API_KEY = "ghost_your_api_key_here"
BASE_URL = "${BASE_URL}"

# Chat completion
response = requests.post(
    f"{BASE_URL}/completions",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "model": "llama-3.3-70b",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }
)

print(response.json())`;

  const jsExample = `const API_KEY = "ghost_your_api_key_here";
const BASE_URL = "${BASE_URL}";

// Chat completion
const response = await fetch(\`\${BASE_URL}/completions\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama-3.3-70b",
    messages: [
      { role: "user", content: "Hello!" }
    ],
    temperature: 0.7,
    max_tokens: 1000
  })
});

const data = await response.json();
console.log(data);`;

  const curlExample = `# Chat completion
curl -X POST "${BASE_URL}/completions" \\
  -H "Authorization: Bearer ghost_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'`;

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-8">
        {/* Quick Start */}
        <section>
          <h3 className="text-sm font-medium mb-3">Quick Start</h3>
          <Tabs defaultValue="python" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="python" className="mt-3">
              <CodeBlock code={pythonExample} language="python" />
            </TabsContent>
            <TabsContent value="javascript" className="mt-3">
              <CodeBlock code={jsExample} language="javascript" />
            </TabsContent>
            <TabsContent value="curl" className="mt-3">
              <CodeBlock code={curlExample} language="bash" />
            </TabsContent>
          </Tabs>
        </section>

        {/* Authentication */}
        <section>
          <h3 className="text-sm font-medium mb-3">Authentication</h3>
          <div className="p-4 rounded-lg bg-muted/30 border text-sm">
            <p className="text-muted-foreground mb-2">
              All API requests require authentication via Bearer token:
            </p>
            <CodeBlock 
              code='Authorization: Bearer ghost_your_api_key_here' 
              language="http" 
            />
          </div>
        </section>

        {/* Endpoints */}
        <section>
          <h3 className="text-sm font-medium mb-3">Endpoints</h3>
          <div className="space-y-4">
            <Endpoint 
              method="POST" 
              path="/completions"
              description="Generate text completions (OpenAI-compatible)"
            >
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Request Body
                </h5>
                <CodeBlock 
                  code={`{
  "model": "llama-3.3-70b",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`}
                  language="json"
                />
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </h5>
                <CodeBlock 
                  code={`{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama-3.3-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}`}
                  language="json"
                />
              </div>
            </Endpoint>

            <Endpoint 
              method="POST" 
              path="/images"
              description="Generate images from text prompts"
            >
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Request Body
                </h5>
                <CodeBlock 
                  code={`{
  "prompt": "A serene mountain landscape",
  "model": "flux-schnell",
  "size": "1024x1024",
  "style": "photorealistic",
  "n": 1
}`}
                  language="json"
                />
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </h5>
                <CodeBlock 
                  code={`{
  "created": 1234567890,
  "data": [{
    "url": "https://...",
    "revised_prompt": "..."
  }]
}`}
                  language="json"
                />
              </div>
            </Endpoint>

            <Endpoint 
              method="POST" 
              path="/videos"
              description="Generate videos (returns job ID for async processing)"
            >
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Request Body
                </h5>
                <CodeBlock 
                  code={`{
  "prompt": "Ocean waves at sunset",
  "model": "runway-gen3",
  "duration": 5,
  "resolution": "1080p"
}`}
                  language="json"
                />
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </h5>
                <CodeBlock 
                  code={`{
  "job_id": "job_xxx",
  "status": "processing"
}`}
                  language="json"
                />
              </div>
            </Endpoint>

            <Endpoint 
              method="GET" 
              path="/jobs/:id"
              description="Check status of async video generation"
            >
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </h5>
                <CodeBlock 
                  code={`{
  "job_id": "job_xxx",
  "status": "completed",
  "video_url": "https://..."
}`}
                  language="json"
                />
              </div>
            </Endpoint>

            <Endpoint 
              method="GET" 
              path="/usage"
              description="Get usage statistics for your API key"
            >
              <div className="space-y-3">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </h5>
                <CodeBlock 
                  code={`{
  "total_requests": 1234,
  "credits_used": 5000,
  "credits_remaining": 45000,
  "breakdown": {
    "text": 4000,
    "image": 800,
    "video": 200
  }
}`}
                  language="json"
                />
              </div>
            </Endpoint>
          </div>
        </section>

        {/* Models */}
        <section>
          <h3 className="text-sm font-medium mb-3">Available Models</h3>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Text Models
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {['llama-3.3-70b', 'llama-3.1-405b', 'qwen-2.5-72b', 'deepseek-v3'].map(m => (
                  <Badge key={m} variant="outline" className="font-mono text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Image Models
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {['flux-schnell', 'flux-dev', 'dalle-3', 'imagen-3'].map(m => (
                  <Badge key={m} variant="outline" className="font-mono text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Video Models
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {['runway-gen3', 'veo-2', 'replicate-ltx'].map(m => (
                  <Badge key={m} variant="outline" className="font-mono text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section>
          <h3 className="text-sm font-medium mb-3">Rate Limits</h3>
          <div className="p-4 rounded-lg bg-muted/30 border text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li>• Default: 60 requests per minute</li>
              <li>• Custom limits configurable per API key</li>
              <li>• Rate limit headers included in responses:</li>
            </ul>
            <CodeBlock 
              code={`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890`}
              language="http"
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
