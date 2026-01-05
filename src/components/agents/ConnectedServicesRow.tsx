import { useIntegrations } from '@/hooks/useIntegrations';
import { cn } from '@/lib/utils';

// Import integration logos
import slackLogo from '@/assets/integrations/slack-logo.png';
import githubLogo from '@/assets/integrations/github-logo.png';
import gmailLogo from '@/assets/integrations/gmail-logo.png';
import notionLogo from '@/assets/integrations/notion-logo.png';
import googledocsLogo from '@/assets/integrations/googledocs-logo.png';

const integrationLogos: Record<string, string> = {
  slack: slackLogo,
  github: githubLogo,
  gmail: gmailLogo,
  notion: notionLogo,
  googledrive: googledocsLogo,
};

interface ConnectedServicesRowProps {
  className?: string;
  maxVisible?: number;
}

export function ConnectedServicesRow({ className, maxVisible = 5 }: ConnectedServicesRowProps) {
  const { integrations, loading: isLoading } = useIntegrations();
  
  const activeIntegrations = integrations.filter(i => i.is_active);
  const visibleIntegrations = activeIntegrations.slice(0, maxVisible);
  const overflowCount = Math.max(0, activeIntegrations.length - maxVisible);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-muted-foreground">Loading services...</span>
      </div>
    );
  }

  if (activeIntegrations.length === 0) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-muted-foreground">No connected services</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground mr-1">Connected:</span>
      <div className="flex items-center -space-x-1">
        {visibleIntegrations.map((integration) => {
          const logo = integrationLogos[integration.integration_type.toLowerCase()];
          return (
            <div
              key={integration.id}
              className="h-6 w-6 rounded-full border-2 border-background bg-card overflow-hidden"
              title={integration.integration_name}
            >
              {logo ? (
                <img
                  src={logo}
                  alt={integration.integration_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-muted flex items-center justify-center text-xs font-medium">
                  {integration.integration_name[0]}
                </div>
              )}
            </div>
          );
        })}
        {overflowCount > 0 && (
          <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
            <span className="text-[10px] font-medium text-muted-foreground">
              +{overflowCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
