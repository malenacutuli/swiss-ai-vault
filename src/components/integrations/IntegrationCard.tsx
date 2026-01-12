// src/components/integrations/IntegrationCard.tsx
import React from 'react';
import { Check, Plus, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface IntegrationCardProps {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  category: string;
  connected: boolean;
  connected_at?: string;
  onConnect: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function IntegrationCard({
  id,
  name,
  description,
  icon_url,
  category,
  connected,
  connected_at,
  onConnect,
  onDisconnect,
  isLoading
}: IntegrationCardProps) {
  const [actionLoading, setActionLoading] = React.useState(false);

  const handleAction = async () => {
    setActionLoading(true);
    try {
      if (connected) {
        await onDisconnect(id);
      } else {
        await onConnect(id);
      }
    } catch (error) {
      console.error('Integration action failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const categoryColors: Record<string, string> = {
    communication: 'bg-blue-100 text-blue-800',
    calendar: 'bg-green-100 text-green-800',
    storage: 'bg-purple-100 text-purple-800',
    productivity: 'bg-orange-100 text-orange-800',
    payment: 'bg-pink-100 text-pink-800'
  };

  return (
    <Card className={`transition-all hover:shadow-md ${connected ? 'border-[#1D4E5F] border-2' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={icon_url}
                alt={name}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-icon.svg';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{name}</h3>
                {connected && (
                  <Check className="w-4 h-4 text-[#1D4E5F]" />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
              <Badge className={`mt-2 ${categoryColors[category] || 'bg-gray-100 text-gray-800'}`}>
                {category}
              </Badge>
            </div>
          </div>

          <Button
            variant={connected ? "outline" : "default"}
            size="sm"
            onClick={handleAction}
            disabled={actionLoading || isLoading}
            className={connected ? '' : 'bg-[#1D4E5F] hover:bg-[#163d4d]'}
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : connected ? (
              'Disconnect'
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Connect
              </>
            )}
          </Button>
        </div>

        {connected && connected_at && (
          <p className="text-xs text-gray-400 mt-4">
            Connected {new Date(connected_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
