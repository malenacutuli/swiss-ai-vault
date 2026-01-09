import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ReasoningEntry {
  id: string;
  agent_type: string;
  reasoning_text: string;
  confidence_score: number | null;
  sources_used: unknown;
  decisions_made: unknown;
  thinking_duration_ms?: number | null;
  model_used?: string | null;
  created_at: string;
}

interface Source {
  id: string;
  source_type: string;
  source_url?: string | null;
  source_title: string | null;
  source_snippet?: string | null;
  citation_key: string | null;
  relevance_score?: number | null;
}

interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  message_content: string;
  created_at: string;
}

interface Props {
  taskId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const agentConfig: Record<string, { name: string; color: string; icon: string }> = {
  planner: { name: 'Planner', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'P' },
  researcher: { name: 'Researcher', color: 'bg-green-100 text-green-800 border-green-200', icon: 'R' },
  executor: { name: 'Executor', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: 'E' },
  verifier: { name: 'Verifier', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: 'V' },
  synthesizer: { name: 'Synthesizer', color: 'bg-teal-100 text-teal-800 border-teal-200', icon: 'S' },
};

export const ReasoningPanel: React.FC<Props> = ({ taskId, isExpanded = true, onToggle }) => {
  const [reasoning, setReasoning] = useState<ReasoningEntry[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'thinking' | 'sources' | 'agents'>('thinking');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;

    setIsLoading(true);
    fetchAll();

    // Subscribe to realtime updates
    const reasoningChannel = supabase
      .channel(`reasoning-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_reasoning',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        setReasoning(prev => [...prev, payload.new as ReasoningEntry]);
      })
      .subscribe();

    const sourcesChannel = supabase
      .channel(`sources-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_sources',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        setSources(prev => [...prev, payload.new as Source]);
      })
      .subscribe();

    const messagesChannel = supabase
      .channel(`messages-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_communications',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as AgentMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reasoningChannel);
      supabase.removeChannel(sourcesChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [taskId]);

  const fetchAll = async () => {
    const [reasoningRes, sourcesRes, messagesRes] = await Promise.all([
      supabase.from('agent_reasoning').select('*').eq('task_id', taskId).order('created_at'),
      supabase.from('agent_sources').select('*').eq('task_id', taskId).order('created_at'),
      supabase.from('agent_communications').select('*').eq('task_id', taskId).order('created_at'),
    ]);

    if (reasoningRes.data) setReasoning(reasoningRes.data);
    if (sourcesRes.data) setSources(sourcesRes.data);
    if (messagesRes.data) setMessages(messagesRes.data);
    setIsLoading(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg border border-border transition-colors text-left"
      >
        Show Agent Reasoning ({reasoning.length} thoughts, {sources.length} sources, {messages.length} messages)
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Agent Reasoning & Transparency</h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="w-full grid grid-cols-3 rounded-none border-b border-border bg-transparent h-auto p-0">
          {[
            { id: 'thinking', label: 'Thinking', count: reasoning.length },
            { id: 'sources', label: 'Sources', count: sources.length },
            { id: 'agents', label: 'Agent Chat', count: messages.length },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "rounded-none border-b-2 border-transparent py-2.5 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary"
              )}
            >
              {tab.label} ({tab.count})
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-sm text-muted-foreground">Loading reasoning data...</div>
            </div>
          ) : (
            <>
              {/* Thinking Tab */}
              <TabsContent value="thinking" className="mt-0 space-y-3">
                {reasoning.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Agent reasoning will appear here as the task executes...
                  </div>
                ) : (
                  reasoning.map((entry) => {
                    const agent = agentConfig[entry.agent_type] || {
                      name: entry.agent_type,
                      color: 'bg-muted text-muted-foreground',
                      icon: '?',
                    };
                    return (
                      <div key={entry.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border", agent.color)}>
                            {agent.icon}
                          </span>
                          <span className="text-sm font-medium text-foreground">{agent.name}</span>
                          {entry.confidence_score != null && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              Confidence: {Math.round(entry.confidence_score * 100)}%
                            </span>
                          )}
                          {entry.thinking_duration_ms != null && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {entry.thinking_duration_ms}ms
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{entry.reasoning_text}</p>
                        
                        {Array.isArray(entry.decisions_made) && entry.decisions_made.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Decisions Made:</p>
                            <div className="flex flex-wrap gap-1">
                              {(entry.decisions_made as string[]).map((d, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.model_used && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Model: {entry.model_used}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Sources Tab */}
              <TabsContent value="sources" className="mt-0 space-y-3">
                {sources.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Sources and citations will appear here...
                  </div>
                ) : (
                  sources.map((source) => (
                    <div key={source.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono px-2 py-0.5 bg-primary/10 text-primary rounded">
                          {source.citation_key || '?'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded uppercase">
                          {source.source_type}
                        </span>
                        {source.relevance_score != null && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {Math.round(source.relevance_score * 100)}% relevant
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{source.source_title || 'Untitled'}</p>
                      {source.source_url && (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate block mt-1"
                        >
                          {source.source_url}
                        </a>
                      )}
                      {source.source_snippet && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          "{source.source_snippet.substring(0, 200)}..."
                        </p>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Agent Chat Tab */}
              <TabsContent value="agents" className="mt-0 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Inter-agent communication will appear here...
                  </div>
                ) : (
                  messages.map((msg) => {
                    const fromAgent = agentConfig[msg.from_agent] || { name: msg.from_agent, color: 'bg-muted', icon: '?' };
                    const toAgent = agentConfig[msg.to_agent] || { name: msg.to_agent, color: 'bg-muted', icon: '?' };
                    return (
                      <div key={msg.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <span className={cn("px-2 py-0.5 rounded font-medium border", fromAgent.color)}>
                            {fromAgent.name}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className={cn("px-2 py-0.5 rounded font-medium border", toAgent.color)}>
                            {toAgent.name}
                          </span>
                          <span className="ml-auto px-2 py-0.5 bg-secondary text-secondary-foreground rounded">
                            {msg.message_type}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80">{msg.message_content}</p>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default ReasoningPanel;
