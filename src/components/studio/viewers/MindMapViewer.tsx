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
import { Download, RotateCcw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getLayoutedElements, deriveEdgesFromNodes, RawMindMapNode, RawMindMapEdge } from '@/lib/mindmapLayout';
import { StylePreset, getStyleConfig } from '@/lib/stylePresets';
import { cn } from '@/lib/utils';

interface MindMapNode {
  id: string;
  label: string;
  parentId?: string;
  type?: 'central' | 'topic' | 'subtopic' | 'detail';
}

interface MindMapViewerProps {
  nodes: MindMapNode[];
  title?: string;
  style?: StylePreset;
}

// Custom node component for styled mind map
function StyledNode({ data }: NodeProps<{ label: string; nodeType: string; styleClass: string }>) {
  return (
    <div className={cn('px-4 py-2 rounded-lg text-center', data.styleClass)}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <span className="text-sm font-medium">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { styled: StyledNode };

export function MindMapViewer({ nodes: inputNodes, title, style = 'corporate' }: MindMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const styleConfig = getStyleConfig(style);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!inputNodes || inputNodes.length === 0) {
      return { flowNodes: [], flowEdges: [] };
    }

    // Convert to raw format for the layout function
    const rawNodes: RawMindMapNode[] = inputNodes.map((n, i) => ({
      id: n.id,
      label: n.label,
      type: n.type || (i === 0 ? 'central' : n.parentId ? 'subtopic' : 'topic'),
      parentId: n.parentId,
    }));

    // Derive edges from parentId relationships
    const rawEdges: RawMindMapEdge[] = deriveEdgesFromNodes(rawNodes);

    // Get layouted elements using Dagre
    const { nodes, edges } = getLayoutedElements(rawNodes, rawEdges, direction);

    // Apply style-specific node styling
    const styledNodes: Node[] = nodes.map((node, index) => {
      const rawNode = rawNodes.find(n => n.id === node.id);
      const nodeType = rawNode?.type || (index === 0 ? 'central' : 'topic');
      
      const styleClass = nodeType === 'central' 
        ? styleConfig.mindmap.central
        : nodeType === 'topic' 
          ? styleConfig.mindmap.topic
          : nodeType === 'detail'
            ? styleConfig.mindmap.detail
            : styleConfig.mindmap.subtopic;

      return {
        ...node,
        type: 'styled',
        data: {
          ...node.data,
          nodeType,
          styleClass,
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
  }, [inputNodes, direction, styleConfig]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update when direction or input changes
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
          Drag nodes to rearrange • Scroll to zoom • Drag background to pan • {inputNodes.length} nodes
        </span>
      </div>
    </div>
  );
}
