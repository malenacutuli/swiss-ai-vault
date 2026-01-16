import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export interface RawMindMapNode {
  id: string;
  label: string;
  type?: 'central' | 'topic' | 'subtopic' | 'detail';
  parentId?: string;
}

export interface RawMindMapEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

/**
 * Use Dagre to automatically layout mind map nodes in a hierarchical structure.
 */
export function getLayoutedElements(
  rawNodes: RawMindMapNode[],
  rawEdges: RawMindMapEdge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: 80, 
    ranksep: 100,
    marginx: 50,
    marginy: 50
  });

  // Add nodes to dagre
  rawNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to dagre
  rawEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Determine node styling based on type
  const getNodeStyle = (nodeType: string) => {
    switch (nodeType) {
      case 'central':
        return {
          background: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: '12px',
          padding: '16px 24px',
          fontSize: '16px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(29, 78, 95, 0.3)',
        };
      case 'topic':
        return {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '2px solid hsl(var(--primary))',
          borderRadius: '10px',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: 500,
        };
      case 'subtopic':
        return {
          background: 'hsl(var(--muted))',
          color: 'hsl(var(--muted-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: 400,
        };
      case 'detail':
      default:
        return {
          background: 'hsl(var(--accent))',
          color: 'hsl(var(--accent-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 400,
        };
    }
  };

  // Convert to React Flow format with calculated positions
  const nodes: Node[] = rawNodes.map((node, index) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeType = node.type || (index === 0 ? 'central' : 'topic');
    
    return {
      id: node.id,
      type: 'default',
      data: { label: node.label },
      position: {
        x: nodeWithPosition?.x ? nodeWithPosition.x - NODE_WIDTH / 2 : index * 200,
        y: nodeWithPosition?.y ? nodeWithPosition.y - NODE_HEIGHT / 2 : index * 100,
      },
      style: getNodeStyle(nodeType),
    };
  });

  const edges: Edge[] = rawEdges.map((edge, index) => ({
    id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: false,
    style: { 
      stroke: 'hsl(var(--primary))', 
      strokeWidth: 2,
      opacity: 0.7 
    },
  }));

  return { nodes, edges };
}

/**
 * Derive edges from nodes that have parentId set.
 */
export function deriveEdgesFromNodes(nodes: RawMindMapNode[]): RawMindMapEdge[] {
  return nodes
    .filter(n => n.parentId)
    .map(n => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
    }));
}
