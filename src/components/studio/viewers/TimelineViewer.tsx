import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  details?: string;
}

interface TimelineViewerProps {
  events: TimelineEvent[];
  title?: string;
}

export function TimelineViewer({ events, title }: TimelineViewerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (events.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No timeline events available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      {title && (
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-medium text-white">{title}</h3>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="h-[500px]">
        <div className="p-6">
          <div className="relative">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/10 -translate-x-1/2" />

            {/* Events */}
            <div className="space-y-8">
              {events.map((event, index) => {
                const isLeft = index % 2 === 0;
                const isExpanded = expandedIds.has(event.id);

                return (
                  <div key={event.id} className="relative">
                    {/* Date marker on center line */}
                    <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10">
                      <div className="w-4 h-4 rounded-full bg-[#e63946] border-4 border-[#0f0f23]" />
                    </div>

                    {/* Event card - alternating left/right */}
                    <div
                      className={cn(
                        'w-[45%]',
                        isLeft ? 'mr-auto pr-8' : 'ml-auto pl-8'
                      )}
                    >
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative">
                        {/* Arrow pointing to center */}
                        <div
                          className={cn(
                            'absolute top-4 w-3 h-3 bg-white/5 border-r border-t border-white/10 rotate-45',
                            isLeft ? '-right-1.5' : '-left-1.5 rotate-[225deg]'
                          )}
                        />

                        {/* Date badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-[#e63946]" />
                          <span className="text-sm text-[#e63946] font-medium">{event.date}</span>
                        </div>

                        {/* Title */}
                        <h4 className="font-medium text-white mb-2">{event.title}</h4>

                        {/* Description */}
                        <p className="text-sm text-white/60">{event.description}</p>

                        {/* Expandable details */}
                        {event.details && (
                          <>
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <p className="text-sm text-white/70">{event.details}</p>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(event.id)}
                              className="mt-2 text-white/40 hover:text-white hover:bg-white/10 p-0 h-auto"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-1" />
                                  Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-1" />
                                  More
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* End marker */}
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
              <div className="w-3 h-3 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
