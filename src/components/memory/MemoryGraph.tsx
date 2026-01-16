import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, X, RefreshCw } from 'lucide-react';

interface MemoryNode {
  id: string;
  title: string;
  source: string;
  aiPlatform?: string; // Specific AI platform: 'claude', 'chatgpt', etc.
  type?: string;
  tags?: string[];
  timestamp: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  source: string;
  aiPlatform?: string;
  type?: string;
  tags?: string[];
  timestamp: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  strength: number;
  sharedTags: string[];
}

interface Props {
  memories: MemoryNode[];
  onSelectMemory?: (id: string) => void;
}

// Vibrant source colors for better visibility
const SOURCE_COLORS: Record<string, string> = {
  chatgpt: '#10B981',         // Emerald green
  claude: '#8B5CF6',          // Purple
  gemini: '#3B82F6',          // Blue
  perplexity: '#F59E0B',      // Amber
  grok: '#EF4444',            // Red
  copilot: '#06B6D4',         // Cyan
  swissbrain_chat: '#EC4899', // Pink
  document: '#6366F1',        // Indigo
  note: '#F97316',            // Orange
  chat: '#10B981',            // Green
  url: '#14B8A6',             // Teal
  captured: '#A855F7',        // Purple for captured memories
  unknown: '#6B7280',         // Gray
};

/**
 * Find connections between memories based on shared tags, documents, and temporal proximity
 */
function findConnections(memories: MemoryNode[]): GraphLink[] {
  const links: GraphLink[] = [];
  
  // Group by document (chunks from same file)
  const byDocument = new Map<string, string[]>();
  memories.forEach(m => {
    // Check for documentId or filename to group chunks
    const docId = (m as any).documentId || (m as any).metadata?.documentId || (m as any).metadata?.filename;
    if (docId) {
      const existing = byDocument.get(docId) || [];
      existing.push(m.id);
      byDocument.set(docId, existing);
    }
  });
  
  // Connect chunks from same document
  byDocument.forEach(ids => {
    for (let i = 0; i < ids.length - 1; i++) {
      links.push({ 
        source: ids[i], 
        target: ids[i + 1], 
        strength: 0.5, 
        sharedTags: ['same-document'] 
      });
    }
  });
  
  // Build tag -> memory IDs map
  const tagMap = new Map<string, string[]>();
  memories.forEach(m => {
    (m.tags || []).forEach(tag => {
      const existing = tagMap.get(tag) || [];
      existing.push(m.id);
      tagMap.set(tag, existing);
    });
  });
  
  // Create links for memories sharing tags
  tagMap.forEach((ids, tag) => {
    if (ids.length < 2 || ids.length > 10) return; // Skip very common tags
    
    for (let i = 0; i < Math.min(ids.length - 1, 5); i++) {
      const existing = links.find(
        l => (l.source === ids[i] && l.target === ids[i + 1]) ||
             (l.source === ids[i + 1] && l.target === ids[i])
      );
      if (existing) {
        existing.strength += 0.15;
        existing.sharedTags.push(tag);
      } else {
        links.push({ source: ids[i], target: ids[i + 1], strength: 0.3, sharedTags: [tag] });
      }
    }
  });
  
  // Connect memories from the same source that are close in time (within 1 hour)
  const bySource = new Map<string, MemoryNode[]>();
  memories.forEach(m => {
    const arr = bySource.get(m.source) || [];
    arr.push(m);
    bySource.set(m.source, arr);
  });
  
  bySource.forEach((mems) => {
    const sorted = [...mems].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const timeDiff = new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
      const hourInMs = 60 * 60 * 1000;
      
      // Only connect if within 1 hour
      if (timeDiff <= hourInMs) {
        const existing = links.find(
          l => (l.source === sorted[i].id && l.target === sorted[i + 1].id) ||
               (l.source === sorted[i + 1].id && l.target === sorted[i].id)
        );
        if (!existing) {
          links.push({ 
            source: sorted[i].id, 
            target: sorted[i + 1].id, 
            strength: 0.2, 
            sharedTags: ['temporal'] 
          });
        }
      }
    }
  });
  
  return links;
}

export function MemoryGraph({ memories, onSelectMemory }: Props) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const links = useMemo(() => findConnections(memories), [memories]);
  
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(
        zoomRef.current.scaleBy, 1.5
      );
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(
        zoomRef.current.scaleBy, 0.67
      );
    }
  }, []);
  
  const handleReset = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(
        zoomRef.current.transform, d3.zoomIdentity
      );
    }
  }, []);
  
  useEffect(() => {
    if (!svgRef.current || memories.length === 0) return;
    
    setIsSimulating(true);
    const svg = d3.select(svgRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = 500;
    
    svg.selectAll('*').remove();
    
    const g = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);
    
    // Create deep copies for simulation
    const nodes: GraphNode[] = memories.map(m => ({ ...m }));
    const simLinks = links.map(l => ({ 
      ...l, 
      source: l.source as string, 
      target: l.target as string 
    }));
    
    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id(d => d.id)
        .distance(100)
        .strength(d => d.strength))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35));
    
    // Draw links FIRST (behind nodes) with better visibility
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', '#94A3B8')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', d => Math.max(1.5, d.strength * 4));
    
    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
      .on('click', (_, d) => {
        setSelectedNode(d);
        onSelectMemory?.(d.id);
      });
    
    // Node circles with source colors and shadow
    // Prefer aiPlatform if available, fallback to source for coloring
    node.append('circle')
      .attr('r', 12)
      .attr('fill', d => {
        const platform = d.aiPlatform || d.source;
        return SOURCE_COLORS[platform?.toLowerCase()] || SOURCE_COLORS.unknown;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))');
    
    // Node labels
    node.append('text')
      .text(d => {
        const title = d.title || 'Untitled';
        return title.length > 20 ? title.slice(0, 20) + '...' : title;
      })
      .attr('x', 16)
      .attr('y', 4)
      .attr('font-size', '11px')
      .attr('fill', '#64748B')
      .attr('font-weight', '500');
    
    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as unknown as GraphNode).x || 0)
        .attr('y1', d => (d.source as unknown as GraphNode).y || 0)
        .attr('x2', d => (d.target as unknown as GraphNode).x || 0)
        .attr('y2', d => (d.target as unknown as GraphNode).y || 0);
      
      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    simulation.on('end', () => setIsSimulating(false));
    
    // Auto-zoom to fit content
    setTimeout(() => {
      const bounds = g.node()?.getBBox();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          width / (bounds.width + 100),
          height / (bounds.height + 100),
          1.5
        );
        const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
        
        svg.transition().duration(500).call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
      }
    }, 1000);
    
    return () => {
      simulation.stop();
    };
  }, [memories, links, onSelectMemory]);
  
  if (memories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t('memory.graph.empty')}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{t('memory.graph.title', 'Gráfico de Memoria')}</CardTitle>
            {isSimulating && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(SOURCE_COLORS)
              .filter(([key]) => key !== 'unknown')
              .slice(0, 8)
              .map(([source, color]) => (
                <Badge 
                  key={source} 
                  variant="outline" 
                  className="text-xs capitalize"
                  style={{ borderColor: color, color }}
                >
                  {source.replace('_', ' ')}
                </Badge>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative rounded-lg border border-border bg-muted/20 overflow-hidden">
          <svg 
            ref={svgRef} 
            className="w-full" 
            style={{ height: 500 }}
          />
          
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Zoom level indicator */}
          <div className="absolute bottom-3 left-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {Math.round(zoomLevel * 100)}%
          </div>
          
          {/* Selected node info */}
          {selectedNode && (
            <div className="absolute bottom-3 right-3 bg-background border border-border rounded-lg p-3 shadow-lg max-w-[280px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{selectedNode.title}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${SOURCE_COLORS[(selectedNode.aiPlatform || selectedNode.source)?.toLowerCase()] || SOURCE_COLORS.unknown}20`,
                        color: SOURCE_COLORS[(selectedNode.aiPlatform || selectedNode.source)?.toLowerCase()] || SOURCE_COLORS.unknown
                      }}
                    >
                      {selectedNode.aiPlatform || selectedNode.source}
                    </Badge>
                    {selectedNode.tags?.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(selectedNode.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 shrink-0" 
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}