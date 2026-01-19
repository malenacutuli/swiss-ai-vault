import { motion } from 'framer-motion';
import {
  Globe,
  Code,
  Monitor,
  Image,
  FolderOpen,
  Search,
  Mail,
  Calendar,
  MessageSquare,
  Github,
  FileText,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'capabilities' | 'tools' | 'integrations';
}

const AVAILABLE_TOOLS: Tool[] = [
  // Capabilities
  {
    id: 'can_search_web',
    name: 'Web Search',
    description: 'Search the web for information',
    icon: Globe,
    category: 'capabilities',
  },
  {
    id: 'can_execute_code',
    name: 'Code Execution',
    description: 'Run Python, JavaScript, and shell code',
    icon: Code,
    category: 'capabilities',
  },
  {
    id: 'can_browse_web',
    name: 'Web Browsing',
    description: 'Navigate and interact with websites',
    icon: Monitor,
    category: 'capabilities',
  },
  {
    id: 'can_generate_images',
    name: 'Image Generation',
    description: 'Create images with DALL-E and Imagen',
    icon: Image,
    category: 'capabilities',
  },
  {
    id: 'can_access_files',
    name: 'File Access',
    description: 'Read and write files in the sandbox',
    icon: FolderOpen,
    category: 'capabilities',
  },
  // Tools
  {
    id: 'deep_research',
    name: 'Deep Research',
    description: 'Multi-source research with citations',
    icon: Search,
    category: 'tools',
  },
  {
    id: 'generate_document',
    name: 'Document Generation',
    description: 'Create DOCX and PDF documents',
    icon: FileText,
    category: 'tools',
  },
  {
    id: 'data_analysis',
    name: 'Data Analysis',
    description: 'Analyze data and create visualizations',
    icon: Database,
    category: 'tools',
  },
  // Integrations
  {
    id: 'email_action',
    name: 'Gmail',
    description: 'Send, search, and manage emails',
    icon: Mail,
    category: 'integrations',
  },
  {
    id: 'calendar_action',
    name: 'Google Calendar',
    description: 'Create and manage calendar events',
    icon: Calendar,
    category: 'integrations',
  },
  {
    id: 'slack_action',
    name: 'Slack',
    description: 'Send messages and manage channels',
    icon: MessageSquare,
    category: 'integrations',
  },
  {
    id: 'github_action',
    name: 'GitHub',
    description: 'Create issues, PRs, and search code',
    icon: Github,
    category: 'integrations',
  },
];

interface AgentToolSelectorProps {
  enabledTools: string[];
  capabilities: {
    can_search_web: boolean;
    can_execute_code: boolean;
    can_browse_web: boolean;
    can_generate_images: boolean;
    can_access_files: boolean;
  };
  onToggleTool: (toolId: string) => void;
  onToggleCapability: (capability: string, enabled: boolean) => void;
}

export function AgentToolSelector({
  enabledTools,
  capabilities,
  onToggleTool,
  onToggleCapability,
}: AgentToolSelectorProps) {
  const capabilityTools = AVAILABLE_TOOLS.filter(t => t.category === 'capabilities');
  const regularTools = AVAILABLE_TOOLS.filter(t => t.category === 'tools');
  const integrations = AVAILABLE_TOOLS.filter(t => t.category === 'integrations');

  const isCapabilityEnabled = (toolId: string) => {
    return capabilities[toolId as keyof typeof capabilities] ?? false;
  };

  const isToolEnabled = (toolId: string) => {
    return enabledTools.includes(toolId);
  };

  const renderToolCard = (tool: Tool, index: number, isCapability: boolean) => {
    const enabled = isCapability ? isCapabilityEnabled(tool.id) : isToolEnabled(tool.id);
    const Icon = tool.icon;

    return (
      <motion.div
        key={tool.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
      >
        <div
          className={cn(
            "flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer",
            enabled
              ? "border-primary/50 bg-primary/5"
              : "border-border hover:border-muted-foreground/30"
          )}
          onClick={() => {
            if (isCapability) {
              onToggleCapability(tool.id, !enabled);
            } else {
              onToggleTool(tool.id);
            }
          }}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              enabled ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Icon className={cn("h-5 w-5", enabled ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{tool.name}</div>
            <div className="text-sm text-muted-foreground truncate">{tool.description}</div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              if (isCapability) {
                onToggleCapability(tool.id, checked);
              } else {
                onToggleTool(tool.id);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Capabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Core Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {capabilityTools.map((tool, i) => renderToolCard(tool, i, true))}
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {regularTools.map((tool, i) => renderToolCard(tool, i, false))}
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Integrations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect to external services (requires authentication)
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {integrations.map((tool, i) => renderToolCard(tool, i, false))}
        </CardContent>
      </Card>
    </div>
  );
}
