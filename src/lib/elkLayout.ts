/**
 * ELK.js Advanced Mind Map Layout
 * Better auto-layout with dynamic node sizing and edge crossing reduction
 */

import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { Node, Edge } from 'reactflow';

const elk = new ELK();

export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';
  nodeSpacing?: number;
  layerSpacing?: number;
  algorithm?: 'layered' | 'force' | 'stress' | 'mrtree';
}

const defaultOptions: ElkLayoutOptions = {
  direction: 'DOWN',
  nodeSpacing: 80,
  layerSpacing: 100,
  algorithm: 'layered',
};

/**
 * Get ELK layout options based on configuration
 */
function getElkOptions(options: ElkLayoutOptions): Record<string, string> {
  const opts = { ...defaultOptions, ...options };
  
  return {
    'elk.algorithm': opts.algorithm === 'mrtree' ? 'org.eclipse.elk.mrtree' : `org.eclipse.elk.${opts.algorithm}`,
    'elk.direction': opts.direction!,
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  };
}

// Extended node type with measured dimensions
interface MeasuredNode extends Node {
  measured?: { width: number; height: number };
}

/**
 * Layout nodes and edges using ELK.js
 * Returns positioned nodes and edges for React Flow
 */
export async function getElkLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: ElkLayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const elkOptions = getElkOptions(options);

  // Build ELK graph
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => {
      const measuredNode = node as MeasuredNode;
      return {
        id: node.id,
        width: measuredNode.measured?.width ?? node.width ?? 200,
        height: measuredNode.measured?.height ?? node.height ?? 80,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })) as ElkExtendedEdge[],
  };

  try {
    const layoutedGraph = await elk.layout(graph);

    // Map positions back to React Flow nodes
    const layoutedNodes = nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      
      if (!elkNode || elkNode.x === undefined || elkNode.y === undefined) {
        return node;
      }

      return {
        ...node,
        position: {
          x: elkNode.x,
          y: elkNode.y,
        },
      };
    });

    return {
      nodes: layoutedNodes,
      edges,
    };
  } catch (error) {
    console.error('[ELK] Layout failed:', error);
    // Return original nodes/edges on error
    return { nodes, edges };
  }
}

/**
 * Calculate layout for hierarchical mind map data
 */
export async function layoutMindMap(
  nodes: Array<{ id: string; label: string; parentId?: string; type?: string }>,
  options: ElkLayoutOptions = {}
): Promise<{ x: number; y: number }[]> {
  const flowNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: node.label },
    width: node.type === 'central' ? 250 : node.type === 'topic' ? 200 : 160,
    height: node.type === 'central' ? 100 : node.type === 'topic' ? 70 : 50,
  }));

  // Derive edges from parentId
  const flowEdges: Edge[] = nodes
    .filter((node) => node.parentId)
    .map((node) => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id,
    }));

  const { nodes: layoutedNodes } = await getElkLayoutedElements(flowNodes, flowEdges, options);

  return layoutedNodes.map((node) => ({
    x: node.position.x,
    y: node.position.y,
  }));
}
