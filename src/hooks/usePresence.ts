// src/hooks/usePresence.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: 'active' | 'idle' | 'away';
  cursorPosition?: { x: number; y: number };
  lastSeen: string;
}

interface UsePresenceOptions {
  workspaceId: string;
  userId: string;
  userInfo: {
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

export function usePresence({ workspaceId, userId, userInfo }: UsePresenceOptions) {
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!workspaceId || !userId) return;

    const presenceChannel = supabase.channel(`workspace:${workspaceId}`, {
      config: {
        presence: { key: userId }
      }
    });

    // Handle presence sync
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const newUsers = new Map<string, PresenceUser>();

      Object.entries(state).forEach(([key, presences]) => {
        const presence = (presences as any[])[0];
        if (presence) {
          newUsers.set(key, {
            userId: key,
            email: presence.email,
            name: presence.name,
            avatarUrl: presence.avatarUrl,
            status: presence.status || 'active',
            cursorPosition: presence.cursorPosition,
            lastSeen: presence.lastSeen || new Date().toISOString()
          });
        }
      });

      setUsers(newUsers);
    });

    // Handle join events
    presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const presence = newPresences[0];
      if (presence) {
        setUsers(prev => {
          const next = new Map(prev);
          next.set(key, {
            userId: key,
            email: presence.email,
            name: presence.name,
            avatarUrl: presence.avatarUrl,
            status: 'active',
            cursorPosition: presence.cursorPosition,
            lastSeen: new Date().toISOString()
          });
          return next;
        });
      }
    });

    // Handle leave events
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      setUsers(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    });

    // Subscribe and track presence
    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          email: userInfo.email,
          name: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
          status: 'active',
          lastSeen: new Date().toISOString()
        });
        setIsConnected(true);
      }
    });

    setChannel(presenceChannel);

    // Cleanup
    return () => {
      presenceChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [workspaceId, userId, userInfo.email, userInfo.name, userInfo.avatarUrl]);

  // Update cursor position
  const updateCursor = useCallback(async (position: { x: number; y: number }) => {
    if (!channel) return;

    await channel.track({
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      status: 'active',
      cursorPosition: position,
      lastSeen: new Date().toISOString()
    });
  }, [channel, userInfo]);

  // Update status
  const updateStatus = useCallback(async (status: 'active' | 'idle' | 'away') => {
    if (!channel) return;

    await channel.track({
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      status,
      lastSeen: new Date().toISOString()
    });
  }, [channel, userInfo]);

  return {
    users: Array.from(users.values()),
    isConnected,
    updateCursor,
    updateStatus
  };
}
