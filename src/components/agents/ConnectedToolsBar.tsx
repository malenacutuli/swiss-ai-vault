import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const AVAILABLE_TOOLS = [
  { id: 'gmail', name: 'Gmail', abbr: 'GM', color: '#EA4335' },
  { id: 'google_calendar', name: 'Google Calendar', abbr: 'GC', color: '#4285F4' },
  { id: 'google_drive', name: 'Google Drive', abbr: 'GD', color: '#0F9D58' },
  { id: 'github', name: 'GitHub', abbr: 'GH', color: '#24292E' },
  { id: 'slack', name: 'Slack', abbr: 'SL', color: '#4A154B' },
  { id: 'notion', name: 'Notion', abbr: 'NO', color: '#000000' },
  { id: 'figma', name: 'Figma', abbr: 'FG', color: '#F24E1E' },
  { id: 'linear', name: 'Linear', abbr: 'LN', color: '#5E6AD2' },
];

interface ConnectedToolsBarProps {
  privacyTier: 'ghost' | 'vault' | 'full';
  setPrivacyTier: (tier: 'ghost' | 'vault' | 'full') => void;
}

export const ConnectedToolsBar = ({ privacyTier, setPrivacyTier }: ConnectedToolsBarProps) => {
  // In production, use actual OAuth connections
  const connectedIds = ['github']; // Example - replace with actual connections
  
  const connectedTools = AVAILABLE_TOOLS.filter(t => connectedIds.includes(t.id));
  const disconnectedCount = AVAILABLE_TOOLS.length - connectedTools.length;
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">Connected:</span>
      
      {/* Connected Tool Badges */}
      <div className="flex items-center gap-1.5">
        {connectedTools.length > 0 ? (
          connectedTools.map((tool) => (
            <div
              key={tool.id}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: tool.color }}
              title={tool.name}
            >
              {tool.abbr}
            </div>
          ))
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </div>
      
      {/* Add More Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
              +{disconnectedCount}
            </span>
            <span>Connect</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-card border-border">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-sm font-medium text-foreground">
              Connect Services
            </span>
          </div>
          {AVAILABLE_TOOLS.map((tool) => {
            const isConnected = connectedIds.includes(tool.id);
            return (
              <DropdownMenuItem
                key={tool.id}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-semibold text-white"
                    style={{ backgroundColor: tool.color }}
                  >
                    {tool.abbr}
                  </div>
                  <span>{tool.name}</span>
                </div>
                {isConnected ? (
                  <span className="text-xs text-primary">Connected</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Connect</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Privacy Tier Selector */}
      <div className="ml-auto">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {(['ghost', 'vault', 'full'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setPrivacyTier(tier)}
              className={cn(
                "px-3 py-1 text-sm rounded-md transition-all capitalize",
                privacyTier === tier
                  ? "bg-card shadow-sm text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
