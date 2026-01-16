import { useMemo, useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Minimize2, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getLayoutedElements, deriveEdgesFromNodes, RawMindMapNode, RawMindMapEdge } from '@/lib/mindmapLayout';
import { StylePreset, getStyleConfig } from '@/lib/stylePresets';
import { cn } from '@/lib/utils';

interface MindMapNode {
  id: string;
  label: string;
  parentId?: string;
  type?: 'central' | 'topic' | 'subtopic' | 'detail';
  citations?: Array<{ source_id: string; text: string }>;
}

interface ExpandableMindMapProps {
  nodes: MindMapNode[];
  title?: string;
  style?: StylePreset;
  onNodeClick?: (node: MindMapNode) => void;
}

// Custom expandable node component
function ExpandableNode({ 
  data,
  id,
  selected,
}: NodeProps<{ 
  label: string; 
  nodeType: string; 
  styleClass: string;
  hasChildren: boolean;
  isExpanded: boolean;
  citationCount: number;
  onToggle: () => void;
  onClick: () => void;
}>) {
  return (
    <div 
      className={cn(
        'relative px-4 py-2 rounded-lg text-center cursor-pointer transition-all',
        data.styleClass,
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      {/* Expand/collapse button */}
      {data.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle();
          }}
          className={cn(
            'absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full',
            'bg-background border border-border shadow-sm',
            'flex items-center justify-center',
            'hover:bg-muted transition-colors'
          )}
        >
          {data.isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      )}

      {/* Node label */}
      <span className="text-sm font-medium">{data.label}</span>

      {/* Citation badge */}
      {data.citationCount > 0 && (
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-medium">
          {data.citationCount}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { expandable: ExpandableNode };

export function ExpandableMindMap({ 
  nodes: inputNodes, 
  title, 
  style = 'corporate',
  onNodeClick,
}: ExpandableMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Start with all nodes expanded
    return new Set(inputNodes.map(n => n.id));
  });
  const styleConfig = getStyleConfig(style);

  // Find all descendant node IDs
  const getDescendants = useCallback((nodeId: string, nodes: MindMapNode[]): string[] => {
    const children = nodes.filter(n => n.parentId === nodeId);
    const descendants: string[] = [];
    for (const child of children) {
      descendants.push(child.id);
      descendants.push(...getDescendants(child.id, nodes));
    }
    return descendants;
  }, []);

  // Check if a node has children
  const hasChildren = useCallback((nodeId: string, nodes: MindMapNode[]): boolean => {
    return nodes.some(n => n.parentId === nodeId);
  }, []);

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        // Collapse: remove this node and all descendants
        next.delete(nodeId);
        const descendants = getDescendants(nodeId, inputNodes);
        descendants.forEach(d => next.delete(d));
      } else {
        // Expand: add only immediate children
        next.add(nodeId);
        inputNodes.filter(n => n.parentId === nodeId).forEach(n => next.add(n.id));
      }
      return next;
    });
  }, [inputNodes, getDescendants]);

  // Expand/collapse all
  const expandAll = useCallback(() => {
    setExpandedNodes(new Set(inputNodes.map(n => n.id)));
  }, [inputNodes]);

  const collapseAll = useCallback(() => {
    // Keep only root nodes (nodes without parentId)
    setExpandedNodes(new Set(inputNodes.filter(n => !n.parentId).map(n => n.id)));
  }, [inputNodes]);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!inputNodes || inputNodes.length === 0) {
      return { flowNodes: [], flowEdges: [] };
    }

    // Filter visible nodes based on expansion state
    const visibleNodes = inputNodes.filter(node => {
      // Root nodes are always visible
      if (!node.parentId) return true;
      // Check if parent is expanded
      return expandedNodes.has(node.parentId);
    });

    // Convert to raw format for the layout function
    const rawNodes: RawMindMapNode[] = visibleNodes.map((n, i) => ({
      id: n.id,
      label: n.label,
      type: n.type || (i === 0 ? 'central' : n.parentId ? 'subtopic' : 'topic'),
      parentId: n.parentId,
    }));

    // Derive edges from parentId relationships (only for visible nodes)
    const rawEdges: RawMindMapEdge[] = deriveEdgesFromNodes(rawNodes);

    // Get layouted elements using Dagre
    const { nodes, edges } = getLayoutedElements(rawNodes, rawEdges, direction);

    // Apply style-specific node styling
    const styledNodes: Node[] = nodes.map((node, index) => {
      const originalNode = inputNodes.find(n => n.id === node.id);
      const rawNode = rawNodes.find(n => n.id === node.id);
      const nodeType = rawNode?.type || (index === 0 ? 'central' : 'topic');
      
      const styleClass = nodeType === 'central' 
        ? styleConfig.mindmap.central
        : nodeType === 'topic' 
          ? styleConfig.mindmap.topic
          : nodeType === 'detail'
            ? styleConfig.mindmap.detail
            : styleConfig.mindmap.subtopic;

      const nodeHasChildren = hasChildren(node.id, inputNodes);
      const isExpanded = expandedNodes.has(node.id);
      const citationCount = originalNode?.citations?.length || 0;

      return {
        ...node,
        type: 'expandable',
        data: {
          ...node.data,
          nodeType,
          styleClass,
          hasChildren: nodeHasChildren,
          isExpanded,
          citationCount,
          onToggle: () => toggleNode(node.id),
          onClick: () => onNodeClick?.(originalNode!),
        },
      };
    });

    // Apply style-specific edge styling
    const styledEdges: Edge[] = edges.map(edge => ({
      ...edge,
      style: {
        stroke: styleConfig.mindmap.edge.stroke,
        strokeWidth: styleConfig.mindmap.edge.strokeWidth,
        opacity: 0.7,
      },
      animated: styleConfig.mindmap.edge.animated || false,
    }));

    return { flowNodes: styledNodes, flowEdges: styledEdges };
  }, [inputNodes, direction, styleConfig, expandedNodes, hasChildren, toggleNode, onNodeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update when flow data changes
  useMemo(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const toggleDirection = useCallback(() => {
    setDirection(d => d === 'TB' ? 'LR' : 'TB');
  }, []);

  // Export as PNG using html2canvas
  const handleExport = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: styleConfig.mindmap.background,
        scale: 2,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `${(title || 'mindmap').replace(/\s+/g, '_')}_${style}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [title, style, styleConfig]);

  if (inputNodes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No mind map data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-foreground">{title || 'Mind Map'}</h3>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: styleConfig.colors.primary + '20',
              color: styleConfig.colors.primary 
            }}
          >
            {styleConfig.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <Minimize2 className="w-4 h-4 mr-2" />
            Collapse
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDirection}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {direction === 'TB' ? 'Vertical' : 'Horizontal'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PNG
          </Button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div 
        ref={containerRef} 
        className="h-[500px] w-full"
        style={{ backgroundColor: styleConfig.mindmap.background }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color={styleConfig.mindmap.edge.stroke + '30'} gap={20} />
          <Controls className="bg-background border border-border rounded-lg" />
          <MiniMap
            nodeColor={() => styleConfig.colors.primary}
            maskColor="rgba(255,255,255,0.9)"
            className="bg-background border border-border rounded-lg"
          />
        </ReactFlow>
      </div>

      {/* Help text */}
      <div className="p-3 border-t border-border text-center">
        <span className="text-xs text-muted-foreground">
          Click +/- to expand/collapse • Double-click to focus • {inputNodes.length} nodes total • {flowNodes.length} visible
        </span>
      </div>
    </div>
  );
}
