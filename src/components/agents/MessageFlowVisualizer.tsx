import { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowDown,
  Send,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AgentRole } from '@/lib/agents/multiagent';

interface AgentMessageItem {
  id: string;
  message_type: string;
  priority: string;
  sender: string;
  sender_role: string | null;
  recipient: string | null;
  recipient_role: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface MessageFlowVisualizerProps {
  taskId: string;
  className?: string;
  maxMessages?: number;
}

const MESSAGE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  task_assignment: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  task_result: { bg: 'bg-green-500/10', text: 'text-green-500' },
  error: { bg: 'bg-destructive/10', text: 'text-destructive' },
  progress: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
  heartbeat: { bg: 'bg-muted', text: 'text-muted-foreground' },
  state_update: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  handoff: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  interrupt: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-muted-foreground',
  normal: 'text-foreground',
  high: 'text-yellow-500',
  critical: 'text-destructive',
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

function getAgentShortName(agentId: string): string {
  if (agentId.includes('orchestrator')) return 'Orch';
  if (agentId.includes('researcher')) return 'Res';
  if (agentId.includes('coder')) return 'Code';
  if (agentId.includes('analyst')) return 'Anly';
  if (agentId.includes('reviewer')) return 'Rev';
  if (agentId.includes('browser')) return 'Brw';
  if (agentId === 'broadcast') return 'All';
  return agentId.slice(0, 4);
}

export function MessageFlowVisualizer({ 
  taskId, 
  className,
  maxMessages = 50 
}: MessageFlowVisualizerProps) {
  const [messages, setMessages] = useState<AgentMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHeartbeats, setShowHeartbeats] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch existing messages
  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .limit(maxMessages);

      if (!error && data) {
        setMessages(data as AgentMessageItem[]);
      }
      setIsLoading(false);
    }

    if (taskId) {
      fetchMessages();
    }
  }, [taskId, maxMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`agent-messages-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const updated = [...prev, payload.new as AgentMessageItem];
            // Keep only last maxMessages
            return updated.slice(-maxMessages);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, maxMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredMessages = showHeartbeats 
    ? messages 
    : messages.filter((m) => m.message_type !== 'heartbeat');

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Message Flow</span>
          <Badge variant="secondary" className="text-xs">
            {filteredMessages.length}
          </Badge>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showHeartbeats}
            onChange={(e) => setShowHeartbeats(e.target.checked)}
            className="rounded border-muted-foreground/50"
          />
          Show heartbeats
        </label>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No messages yet
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredMessages.map((message) => {
              const typeColors = MESSAGE_TYPE_COLORS[message.message_type] || 
                MESSAGE_TYPE_COLORS.state_update;
              const priorityColor = PRIORITY_COLORS[message.priority] || PRIORITY_COLORS.normal;

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg border',
                    typeColors.bg,
                    'border-transparent'
                  )}
                >
                  {/* Flow indicator */}
                  <div className="flex items-center gap-1 min-w-[100px] text-xs">
                    <Badge variant="outline" className="text-[10px] px-1">
                      {getAgentShortName(message.sender)}
                    </Badge>
                    {message.recipient ? (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px] px-1">
                          {getAgentShortName(message.recipient)}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px] px-1">
                          All
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* Message content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px]', typeColors.text, typeColors.bg)}>
                        {message.message_type}
                      </Badge>
                      {message.priority !== 'normal' && (
                        <Badge variant="outline" className={cn('text-[10px]', priorityColor)}>
                          {message.priority}
                        </Badge>
                      )}
                    </div>
                    {message.payload && Object.keys(message.payload).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {message.payload.message as string || 
                         message.payload.description as string ||
                         JSON.stringify(message.payload).slice(0, 80)}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
