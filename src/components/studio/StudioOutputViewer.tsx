import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StylePreset } from '@/lib/stylePresets';
import { StyleSelector } from './StyleSelector';

// Import all viewers
import { AudioPlayer } from './viewers/AudioPlayer';
import { FlashcardViewer } from './viewers/FlashcardViewer';
import { MindMapViewer } from './viewers/MindMapViewer';
import { QuizViewer } from './viewers/QuizViewer';
import { SlidesViewer } from './viewers/SlidesViewer';
import { TimelineViewer } from './viewers/TimelineViewer';
import { FAQViewer } from './viewers/FAQViewer';
import { DataTableViewer } from './viewers/DataTableViewer';
import { ReportViewer } from './viewers/ReportViewer';

type OutputType = 
  | 'podcast' | 'mindmap' | 'report' 
  | 'flashcards' | 'quiz' | 'slides' 
  | 'table' | 'faq' | 'timeline' | 'study_guide';

interface StudioOutputViewerProps {
  type: OutputType;
  data: any;
  onClose?: () => void;
}

function unwrapData(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return unwrapData(data[0]) || {};
  if (data["0"] && typeof data["0"] === 'object' && !Array.isArray(data["0"])) {
    return unwrapData(data["0"]);
  }
  return data;
}

function findParentFromEdges(nodeId: string, edges: any[]): string | undefined {
  const edge = edges?.find((e: any) => e.target === nodeId || e.to === nodeId);
  return edge?.source || edge?.from;
}

// Types that support style presets
const STYLEABLE_TYPES: OutputType[] = ['mindmap', 'slides', 'quiz', 'flashcards'];

export function StudioOutputViewer({ type, data: rawData, onClose }: StudioOutputViewerProps) {
  const { toast } = useToast();
  const [style, setStyle] = useState<StylePreset>('corporate');
  const data = unwrapData(rawData);

  const renderContent = () => {
    switch (type) {
      case 'podcast':
        if (data?.audioUrl || data?.audio_url) {
          return (
            <AudioPlayer
              url={data.audioUrl || data.audio_url}
              title={data.title || 'Podcast'}
              transcript={data.transcript ? 
                (typeof data.transcript === 'string' 
                  ? [{ time: 0, text: data.transcript }] 
                  : data.segments?.map((s: any, i: number) => ({ time: i * 30, text: s.text || s.content }))
                ) : undefined
              }
            />
          );
        }
        return <ReportViewer title="Podcast Transcript" content={data?.transcript || JSON.stringify(data, null, 2)} />;

      case 'quiz':
        const quizQuestions = (data?.questions || []).map((q: any, i: number) => ({
          id: q.id || `q_${i}`,
          question: q.question,
          options: q.options || q.choices || [],
          correctIndex: q.correct_index ?? q.correctIndex ?? q.correct ?? 0,
          explanation: q.explanation || '',
        }));
        if (quizQuestions.length === 0) {
          return <ReportViewer title="Quiz" content="No quiz questions found." />;
        }
        return <QuizViewer questions={quizQuestions} title={data?.title} style={style} />;

      case 'flashcards':
        const flashcards = (data?.cards || data?.flashcards || []).map((c: any, i: number) => ({
          id: c.id || `card_${i}`,
          front: c.front || c.question,
          back: c.back || c.answer,
        }));
        if (flashcards.length === 0) {
          return <ReportViewer title="Flashcards" content="No flashcards found." />;
        }
        return <FlashcardViewer cards={flashcards} title={data?.title} style={style} />;

      case 'mindmap':
        const edges = data?.edges || [];
        const mindmapNodes = (data?.nodes || []).map((n: any) => ({
          id: n.id,
          label: n.label || n.title || n.text || n.name,
          parentId: n.parentId || n.parent_id || n.parent || findParentFromEdges(n.id, edges),
        }));
        if (mindmapNodes.length === 0) {
          return <ReportViewer title="Mind Map" content="No mind map nodes found." />;
        }
        return <MindMapViewer nodes={mindmapNodes} title={data?.title} style={style} />;

      case 'slides':
        const slides = (data?.slides || []).map((s: any, i: number) => {
          let content = '';
          if (Array.isArray(s.bullets) && s.bullets.length > 0) {
            content = '• ' + s.bullets.join('\n• ');
          } else if (typeof s.content === 'string') {
            content = s.content;
          } else if (Array.isArray(s.content)) {
            content = '• ' + s.content.join('\n• ');
          } else if (s.subtitle) {
            content = s.subtitle;
          }
          return {
            id: s.id || `slide_${i}`,
            title: s.title || `Slide ${i + 1}`,
            content,
            notes: s.notes || s.speakerNotes,
            imageUrl: s.imageUrl || s.image_url,
          };
        });
        if (slides.length === 0) {
          return <ReportViewer title="Presentation" content="No slides found." />;
        }
        return <SlidesViewer slides={slides} title={data?.title} style={style} />;

      case 'timeline':
        const events = (data?.events || data?.timeline || []).map((e: any, i: number) => ({
          id: e.id || `event_${i}`,
          date: e.date || e.year || e.time || '',
          title: e.title || e.event || e.name || '',
          description: e.description || e.content || '',
          details: e.details || e.significance,
        }));
        if (events.length === 0) {
          return <ReportViewer title="Timeline" content="No events found." />;
        }
        return <TimelineViewer events={events} title={data?.title} />;

      case 'faq':
        const faqItems = (data?.questions || data?.faqs || data?.items || []).map((q: any, i: number) => ({
          id: q.id || `faq_${i}`,
          question: q.question || q.q,
          answer: q.answer || q.a,
        }));
        if (faqItems.length === 0) {
          return <ReportViewer title="FAQ" content="No FAQ items found." />;
        }
        return <FAQViewer items={faqItems} title={data?.title} />;

      case 'table':
        let tableData: Record<string, any>[] = [];
        if (data?.rows && data?.columns) {
          tableData = data.rows.map((row: any) => {
            const obj: Record<string, any> = {};
            if (Array.isArray(row)) {
              data.columns.forEach((col: string, j: number) => { obj[col] = row[j]; });
            } else if (row.values) {
              obj['Label'] = row.label;
              data.columns.forEach((col: string, j: number) => { obj[col] = row.values[j]; });
            } else {
              return row;
            }
            return obj;
          });
        } else if (data?.data) {
          tableData = data.data;
        }
        if (tableData.length === 0) {
          return <ReportViewer title="Data Table" content="No table data found." />;
        }
        return <DataTableViewer data={tableData} columns={data?.columns} title={data?.title} />;

      case 'report':
      case 'study_guide':
        return (
          <ReportViewer
            title={data?.title}
            content={data?.content || data?.report || ''}
            sections={data?.sections}
            citations={data?.citations}
          />
        );

      default:
        return (
          <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[500px]">
            <pre className="text-sm text-foreground whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {/* Header with style selector */}
      <div className="flex items-center justify-between mb-4">
        {STYLEABLE_TYPES.includes(type) && (
          <StyleSelector selected={style} onChange={setStyle} />
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground ml-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {renderContent()}
    </div>
  );
}
