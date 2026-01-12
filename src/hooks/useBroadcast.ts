// src/hooks/useBroadcast.ts
import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type BroadcastEvent = {
  type: string;
  payload: any;
  sender: string;
  timestamp: string;
};

interface UseBroadcastOptions {
  channelName: string;
  userId: string;
  onMessage?: (event: BroadcastEvent) => void;
}

export function useBroadcast({ channelName, userId, onMessage }: UseBroadcastOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!channelName) return;

    const broadcastChannel = supabase.channel(channelName);

    broadcastChannel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (onMessage && payload.sender !== userId) {
          onMessage(payload as BroadcastEvent);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    setChannel(broadcastChannel);

    return () => {
      broadcastChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [channelName, userId, onMessage]);

  const broadcast = useCallback(async (type: string, payload: any) => {
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        type,
        payload,
        sender: userId,
        timestamp: new Date().toISOString()
      }
    });
  }, [channel, userId]);

  return {
    broadcast,
    isConnected
  };
}
