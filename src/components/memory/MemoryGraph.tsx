import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

interface MemoryNode {
  id: string;
  title: string;
  source: string;
  type?: string;
  tags?: string[];
  timestamp: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  source: string;
  type?: string;
  tags?: string[];
  timestamp: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  strength: number;
}

interface Props {
  memories: MemoryNode[];
  onSelectMemory?: (id: string) => void;
}

// Color mapping for sources using CSS variables where possible
const SOURCE_COLORS: Record<string, string> = {
  chatgpt: '#10B981',    // Green
  claude: '#8B5CF6',     // Purple
  gemini: '#3B82F6',     // Blue
  perplexity: '#F59E0B', // Amber
  grok: '#EF4444',       // Red
  copilot: '#06B6D4',    // Cyan
  document: '#6B7280',   // Gray
  note: '#EC4899',       // Pink
  chat: '#10B981',       // Green (for imported chats)
  url: '#3B82F6',        // Blue
};

/**
 * Find connections between memories based on shared tags/topics
 */
function findConnections(memories: MemoryNode[]): GraphLink[] {
  const links: GraphLink[] = [];
  const tagMap = new Map<string, string[]>();
  
  // Build tag -> memory IDs map
  memories.forEach(m => {
    (m.tags || []).forEach(tag => {
      const existing = tagMap.get(tag) || [];
      existing.push(m.id);
      tagMap.set(tag, existing);
    });
  });
  
  // Create links for memories sharing tags
  tagMap.forEach((ids) => {
    if (ids.length < 2) return;
    
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const existing = links.find(
          l => (l.source === ids[i] && l.target === ids[j]) ||
               (l.source === ids[j] && l.target === ids[i])
        );
        if (existing) {
          existing.strength += 0.2;
        } else {
          links.push({ source: ids[i], target: ids[j], strength: 0.3 });
        }
      }
    }
  });
  
  // Also connect memories from the same source that are close in time
  const bySource = new Map<string, MemoryNode[]>();
  memories.forEach(m => {
    const arr = bySource.get(m.source) || [];
    arr.push(m);
    bySource.set(m.source, arr);
  });
  
  bySource.forEach((mems) => {
    // Sort by timestamp
    const sorted = [...mems].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Connect adjacent memories in time
    for (let i = 0; i < sorted.length - 1; i++) {
      const existing = links.find(
        l => (l.source === sorted[i].id && l.target === sorted[i + 1].id) ||
             (l.source === sorted[i + 1].id && l.target === sorted[i].id)
      );
      if (!existing) {
        links.push({ source: sorted[i].id, target: sorted[i + 1].id, strength: 0.15 });
      }
    }
  });
  
  return links;
}

export function MemoryGraph({ memories, onSelectMemory }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
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
    
    const svg = d3.select(svgRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = 500;
    
    // Clear previous
    svg.selectAll('*').remove();
    
    // Create container group for zoom
    const g = svg.append('g');
    
    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);
    
    // Prepare nodes
    const nodes: GraphNode[] = memories.map(m => ({ ...m }));
    
    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(80)
        .strength(d => d.strength))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(25));
    
    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', d => Math.max(1, d.strength * 3));
    
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
    
    // Node circles
    node.append('circle')
      .attr('r', 10)
      .attr('fill', d => SOURCE_COLORS[d.source] || '#6B7280')
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 2);
    
    // Node labels
    node.append('text')
      .text(d => d.title.slice(0, 15) + (d.title.length > 15 ? '...' : ''))
      .attr('x', 14)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', 'hsl(var(--muted-foreground))');
    
    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0);
      
      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    return () => {
      simulation.stop();
    };
  }, [memories, links, onSelectMemory]);
  
  if (memories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No memories to visualize. Add some content first.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Memory Graph</CardTitle>
          <div className="flex flex-wrap gap-1">
            {Object.entries(SOURCE_COLORS).slice(0, 5).map(([source, color]) => (
              <Badge 
                key={source} 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: color, color }}
              >
                {source}
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
            <div className="absolute bottom-3 right-3 bg-background border border-border rounded-lg p-3 shadow-lg max-w-[250px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedNode.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${SOURCE_COLORS[selectedNode.source] || '#6B7280'}20`,
                        color: SOURCE_COLORS[selectedNode.source] || '#6B7280'
                      }}
                    >
                      {selectedNode.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedNode.timestamp).toLocaleDateString()}
                    </span>
                  </div>
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
