import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MindMapNode {
  id: string;
  label: string;
  parentId?: string;
}

interface MindMapViewerProps {
  nodes: MindMapNode[];
  title?: string;
}

function calculateRadialPosition(index: number, total: number, level: number = 1): { x: number; y: number } {
  if (index === 0) return { x: 400, y: 300 };
  
  const radius = 150 * level;
  const angle = ((index - 1) / Math.max(total - 1, 1)) * 2 * Math.PI - Math.PI / 2;
  
  return {
    x: 400 + radius * Math.cos(angle),
    y: 300 + radius * Math.sin(angle),
  };
}

export function MindMapViewer({ nodes: inputNodes, title }: MindMapViewerProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!inputNodes || inputNodes.length === 0) {
      return { flowNodes: [], flowEdges: [] };
    }

    // Find root nodes (no parentId)
    const rootNodes = inputNodes.filter((n) => !n.parentId);
    const childNodes = inputNodes.filter((n) => n.parentId);

    // Group children by parent
    const childrenByParent: Record<string, MindMapNode[]> = {};
    childNodes.forEach((child) => {
      if (child.parentId) {
        if (!childrenByParent[child.parentId]) {
          childrenByParent[child.parentId] = [];
        }
        childrenByParent[child.parentId].push(child);
      }
    });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Position root nodes
    rootNodes.forEach((node, i) => {
      const pos = calculateRadialPosition(i, rootNodes.length, 0);
      nodes.push({
        id: node.id,
        data: { label: node.label },
        position: pos,
        style: {
          background: '#e63946',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)',
        },
      });

      // Position children of this root
      const children = childrenByParent[node.id] || [];
      children.forEach((child, ci) => {
        const childPos = {
          x: pos.x + Math.cos((ci / children.length) * 2 * Math.PI) * 180,
          y: pos.y + Math.sin((ci / children.length) * 2 * Math.PI) * 180,
        };

        nodes.push({
          id: child.id,
          data: { label: child.label },
          position: childPos,
          style: {
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '13px',
          },
        });

        edges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          style: { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 },
          animated: false,
        });
      });
    });

    // Handle orphan children (parent not in rootNodes)
    childNodes
      .filter((c) => !rootNodes.find((r) => r.id === c.parentId))
      .forEach((child, i) => {
        if (!nodes.find((n) => n.id === child.id)) {
          const pos = calculateRadialPosition(i + rootNodes.length, childNodes.length);
          nodes.push({
            id: child.id,
            data: { label: child.label },
            position: pos,
            style: {
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '13px',
            },
          });

          if (child.parentId) {
            edges.push({
              id: `${child.parentId}-${child.id}`,
              source: child.parentId,
              target: child.id,
              style: { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 },
            });
          }
        }
      });

    return { flowNodes: nodes, flowEdges: edges };
  }, [inputNodes]);

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);

  if (inputNodes.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No mind map data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {title && (
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-medium text-white">{title}</h3>
        </div>
      )}

      <div className="h-[500px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.05)" gap={20} />
          <Controls
            className="bg-white/10 border border-white/10 rounded-lg [&>button]:bg-white/5 [&>button]:border-white/10 [&>button]:text-white [&>button:hover]:bg-white/10"
          />
          <MiniMap
            nodeColor={(node) => (node.style?.background as string) || '#e63946'}
            maskColor="rgba(0,0,0,0.8)"
            className="bg-white/5 border border-white/10 rounded-lg"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
