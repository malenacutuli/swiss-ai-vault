/**
 * SwissBrAIn Live Preview Component
 * Instant visual feedback showing how themes affect artifacts
 */

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { StylePreset, getStyleConfig, StyleConfig } from '@/lib/stylePresets';
import { 
  ReactFlow, 
  Node, 
  Edge, 
  Background, 
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface LivePreviewProps {
  theme: StylePreset;
  previewType?: 'mindmap' | 'slide' | 'both';
  onTypeChange?: (type: 'mindmap' | 'slide' | 'both') => void;
  className?: string;
}

// Mock data for preview
const mockMindMapData = {
  nodes: [
    { id: 'central', label: 'Main Concept', type: 'central' },
    { id: 'topic-1', label: 'Key Insight A', type: 'topic' },
    { id: 'topic-2', label: 'Key Insight B', type: 'topic' },
    { id: 'topic-3', label: 'Key Insight C', type: 'topic' },
    { id: 'sub-1a', label: 'Detail 1', type: 'subtopic' },
    { id: 'sub-1b', label: 'Detail 2', type: 'subtopic' },
  ],
  edges: [
    { source: 'central', target: 'topic-1' },
    { source: 'central', target: 'topic-2' },
    { source: 'central', target: 'topic-3' },
    { source: 'topic-1', target: 'sub-1a' },
    { source: 'topic-1', target: 'sub-1b' },
  ],
};

// Custom node for preview
function PreviewNode({ data }: { data: { label: string; nodeClass: string } }) {
  return (
    <div className={cn(
      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
      data.nodeClass
    )}>
      {data.label}
    </div>
  );
}

const nodeTypes = {
  preview: PreviewNode,
};

// Mind Map Preview Component
function MindMapPreview({ config }: { config: StyleConfig }) {
  const nodes: Node[] = useMemo(() => 
    mockMindMapData.nodes.map((node, i) => {
      const nodeClass = node.type === 'central' 
        ? config.mindmap.central
        : node.type === 'topic'
        ? config.mindmap.topic
        : config.mindmap.subtopic;

      // Simple grid layout for preview
      const cols = 3;
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      return {
        id: node.id,
        type: 'preview',
        position: { 
          x: node.type === 'central' ? 150 : 50 + col * 120,
          y: node.type === 'central' ? 20 : 80 + row * 50
        },
        data: { label: node.label, nodeClass },
      };
    })
  , [config]);

  const edges: Edge[] = useMemo(() => 
    mockMindMapData.edges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      style: { 
        stroke: config.mindmap.edge.stroke, 
        strokeWidth: config.mindmap.edge.strokeWidth 
      },
      animated: config.mindmap.edge.animated,
    }))
  , [config]);

  const [nodesState] = useNodesState(nodes);
  const [edgesState] = useEdgesState(edges);

  return (
    <div 
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ backgroundColor: config.mindmap.background }}
    >
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        nodeTypes={nodeTypes}
        fitView
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        preventScrolling
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.5}
        maxZoom={1}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#ddd" />
      </ReactFlow>
    </div>
  );
}

// Slide Preview Component
function SlidePreview({ config }: { config: StyleConfig }) {
  return (
    <div className={cn(
      'w-full aspect-video rounded-lg overflow-hidden relative',
      config.slides.bg
    )}>
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', config.slides.accent)} />
      
      {/* Content */}
      <div className="p-6 pl-8">
        <h2 className={cn('text-2xl mb-2', config.slides.titleClass)}>
          Presentation Title
        </h2>
        <p className={cn('text-sm', config.slides.subtitleClass)}>
          Subtitle or key message
        </p>
        
        {/* Mock bullets */}
        <ul className="mt-4 space-y-1">
          {['Key point one', 'Key point two', 'Key point three'].map((text, i) => (
            <li key={i} className={cn('text-xs flex items-center gap-2', config.slides.bulletClass)}>
              <span className="w-1 h-1 rounded-full bg-current opacity-50" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      
      {/* AI Image placeholder */}
      <div className="absolute bottom-4 right-4 w-24 h-16 rounded bg-white/10 flex items-center justify-center">
        <span className="text-xs text-white/30">AI Image</span>
      </div>
    </div>
  );
}

export function LivePreview({ 
  theme, 
  previewType = 'both', 
  onTypeChange,
  className 
}: LivePreviewProps) {
  const [localType, setLocalType] = useState<'mindmap' | 'slide' | 'both'>(previewType);
  const config = getStyleConfig(theme);

  const handleTypeChange = (type: 'mindmap' | 'slide' | 'both') => {
    setLocalType(type);
    onTypeChange?.(type);
  };

  const activeType = onTypeChange ? previewType : localType;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Live Preview</span>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {(['mindmap', 'slide', 'both'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-colors capitalize',
                activeType === type
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {type === 'both' ? 'Split' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Canvas */}
      <div className="relative bg-muted/50 rounded-xl p-4 min-h-[200px]">
        {/* PREVIEW watermark */}
        <span className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Preview
        </span>

        <div className={cn(
          'grid gap-4',
          activeType === 'both' ? 'grid-cols-2' : 'grid-cols-1'
        )}>
          {(activeType === 'mindmap' || activeType === 'both') && (
            <div className="h-40">
              <MindMapPreview config={config} />
            </div>
          )}

          {(activeType === 'slide' || activeType === 'both') && (
            <SlidePreview config={config} />
          )}
        </div>
      </div>

      {/* Theme info */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Theme: <span className="font-medium text-foreground">{config.name}</span></span>
        <div className="flex items-center gap-1">
          <div 
            className="w-3 h-3 rounded-full border border-border"
            style={{ backgroundColor: config.colors.primary }}
          />
          <div 
            className="w-3 h-3 rounded-full border border-border"
            style={{ backgroundColor: config.colors.accent }}
          />
        </div>
      </div>
    </div>
  );
}

export default LivePreview;
