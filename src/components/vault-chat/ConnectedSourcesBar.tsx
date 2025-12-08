import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Import integration logos
import githubLogo from '@/assets/integrations/github-logo.png';
import notionLogo from '@/assets/integrations/notion-logo.png';
import figmaLogo from '@/assets/integrations/figma-logo.png';
import slackLogo from '@/assets/integrations/slack-logo.png';
import gmailLogo from '@/assets/integrations/gmail-logo.png';
import asanaLogo from '@/assets/integrations/asana-logo.png';
import azureLogo from '@/assets/integrations/azure-logo.jpg';
import awsLogo from '@/assets/integrations/aws-logo.png';
import googledocsLogo from '@/assets/integrations/googledocs-logo.png';
import huggingfaceLogo from '@/assets/integrations/huggingface-logo.png';

interface IntegrationDef {
  id: string;
  name: string;
  type: string;
  icon: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  { id: 'github', name: 'GitHub', type: 'github', icon: githubLogo },
  { id: 'notion', name: 'Notion', type: 'notion', icon: notionLogo },
  { id: 'figma', name: 'Figma', type: 'figma', icon: figmaLogo },
  { id: 'slack', name: 'Slack', type: 'slack', icon: slackLogo },
  { id: 'gmail', name: 'Gmail', type: 'gmail', icon: gmailLogo },
  { id: 'asana', name: 'Asana', type: 'asana', icon: asanaLogo },
  { id: 'azure', name: 'Azure DevOps', type: 'azure', icon: azureLogo },
  { id: 'aws', name: 'AWS', type: 'aws', icon: awsLogo },
  { id: 'googledocs', name: 'Google Docs', type: 'googledocs', icon: googledocsLogo },
  { id: 'huggingface', name: 'Hugging Face', type: 'huggingface', icon: huggingfaceLogo },
];

interface ConnectedSourcesBarProps {
  integrations: Array<{
    type: string;
    isConnected: boolean;
    isActive: boolean;
  }>;
  onToggle: (type: string) => void;
  onConnect: (type: string) => void;
  className?: string;
}

export function ConnectedSourcesBar({ 
  integrations: connectedIntegrations, 
  onToggle, 
  onConnect,
  className 
}: ConnectedSourcesBarProps) {
  // Merge default integrations with connected status
  const mergedIntegrations = INTEGRATIONS.map(int => {
    const connected = connectedIntegrations.find(c => c.type === int.type);
    return {
      ...int,
      isConnected: connected?.isConnected ?? false,
      isActive: connected?.isActive ?? false,
    };
  });
  
  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center justify-center gap-1.5 p-2 bg-muted/50 rounded-full border",
        className
      )}>
        {mergedIntegrations.map((integration) => (
          <Tooltip key={integration.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (integration.isConnected) {
                    onToggle(integration.type);
                  } else {
                    onConnect(integration.type);
                  }
                }}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all overflow-hidden",
                  integration.isConnected 
                    ? integration.isActive
                      ? "bg-background shadow-sm ring-2 ring-primary/30"
                      : "bg-background/60 hover:bg-background"
                    : "opacity-40 hover:opacity-70 grayscale hover:grayscale-0"
                )}
              >
                <img 
                  src={integration.icon}
                  alt={integration.name}
                  className="w-5 h-5 object-contain"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-center">
                <p className="font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">
                  {integration.isConnected 
                    ? integration.isActive 
                      ? 'Active in context (click to disable)'
                      : 'Connected (click to enable)'
                    : 'Click to connect'
                  }
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
