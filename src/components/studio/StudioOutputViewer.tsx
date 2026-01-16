import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PptxGenJS from 'pptxgenjs';
import { useToast } from '@/hooks/use-toast';

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

/**
 * Helper to unwrap data that may be wrapped in {"0": {...}} or array structure.
 * Gemini sometimes returns JSON in unexpected formats.
 */
function unwrapData(data: any): any {
  if (!data) return data;
  
  // Handle array response - take first element
  if (Array.isArray(data)) {
    return unwrapData(data[0]) || {};
  }
  
  // Handle object with numeric keys like {"0": {...}}
  if (data["0"] && typeof data["0"] === 'object' && !Array.isArray(data["0"])) {
    return unwrapData(data["0"]);
  }
  
  return data;
}

/**
 * Helper to find parent ID from edges array for mind map nodes.
 */
function findParentFromEdges(nodeId: string, edges: any[]): string | undefined {
  const edge = edges?.find((e: any) => e.target === nodeId || e.to === nodeId);
  return edge?.source || edge?.from;
}

export function StudioOutputViewer({ type, data: rawData, onClose }: StudioOutputViewerProps) {
  const { toast } = useToast();
  
  // Unwrap the data to handle nested structures
  const data = unwrapData(rawData);

  // Generate and download PPTX from slides data
  const handleSlidesDownload = async () => {
    const slidesData = data?.slides || [];
    if (slidesData.length === 0) return;
    
    try {
      const pptx = new PptxGenJS();
      pptx.title = data.title || 'Presentation';
      pptx.author = 'Studio';
      
      // Define master slide with sovereignTeal accent
      pptx.defineSlideMaster({
        title: 'STUDIO_MASTER',
        background: { color: 'FFFFFF' },
        objects: [
          { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: '1D4E5F' } } },
        ],
      });

      for (const slide of slidesData) {
        const pptxSlide = pptx.addSlide({ masterName: 'STUDIO_MASTER' });
        
        // Title
        pptxSlide.addText(slide.title || `Slide ${slide.number || ''}`, {
          x: 0.5,
          y: 0.8,
          w: 9,
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: '1D4E5F',
        });

        // Subtitle
        if (slide.subtitle) {
          pptxSlide.addText(slide.subtitle, {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 0.5,
            fontSize: 18,
            color: '666666',
          });
        }

        // Content or Bullets - handle multiple formats
        let content: string[] = [];
        if (Array.isArray(slide.bullets)) {
          content = slide.bullets;
        } else if (typeof slide.content === 'string') {
          content = slide.content.split('\n').filter(Boolean);
        } else if (Array.isArray(slide.content)) {
          content = slide.content;
        }
        
        if (content.length > 0) {
          pptxSlide.addText(
            content.map((b: string) => ({ text: b, options: { bullet: true } })),
            {
              x: 0.5,
              y: slide.subtitle ? 2.2 : 1.8,
              w: 9,
              h: 3,
              fontSize: 16,
              color: '333333',
              valign: 'top',
            }
          );
        }

        // Speaker notes
        if (slide.notes || slide.speakerNotes) {
          pptxSlide.addNotes(slide.notes || slide.speakerNotes);
        }
      }

      const fileName = `${(data.title || 'Presentation').replace(/\s+/g, '_')}.pptx`;
      await pptx.writeFile({ fileName });
      
      toast({ title: 'Downloaded!', description: fileName });
    } catch (error) {
      console.error('PPTX generation error:', error);
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'podcast':
        // Check if we have audio URL or just transcript
        if (data?.audioUrl || data?.audio_url) {
          return (
            <AudioPlayer
              url={data.audioUrl || data.audio_url}
              title={data.title || 'Podcast'}
              transcript={data.transcript ? 
                (typeof data.transcript === 'string' 
                  ? [{ time: 0, text: data.transcript }] 
                  : data.segments?.map((s: any, i: number) => ({
                      time: i * 30,
                      text: s.text || s.content
                    }))
                ) : undefined
              }
            />
          );
        }
        // Fallback to transcript-only view
        return (
          <ReportViewer
            title="Podcast Transcript"
            content={data?.transcript || JSON.stringify(data, null, 2)}
          />
        );

      case 'quiz':
        const quizQuestions = (data?.questions || []).map((q: any, i: number) => ({
          id: q.id || `q_${i}`,
          question: q.question,
          options: q.options || q.choices || [],
          correctIndex: q.correct_index ?? q.correctIndex ?? q.correct ?? 0,
          explanation: q.explanation || '',
        }));
        
        if (quizQuestions.length === 0) {
          return <ReportViewer title="Quiz" content="No quiz questions found in the data." />;
        }
        
        return <QuizViewer questions={quizQuestions} title={data?.title} />;

      case 'flashcards':
        const flashcards = (data?.cards || data?.flashcards || []).map((c: any, i: number) => ({
          id: c.id || `card_${i}`,
          front: c.front || c.question,
          back: c.back || c.answer,
        }));
        
        if (flashcards.length === 0) {
          return <ReportViewer title="Flashcards" content="No flashcards found in the data." />;
        }
        
        return <FlashcardViewer cards={flashcards} title={data?.title} />;

      case 'mindmap':
        // Get edges for parent ID lookup
        const edges = data?.edges || [];
        
        // Transform nodes with proper parentId resolution
        const mindmapNodes = (data?.nodes || []).map((n: any) => ({
          id: n.id,
          label: n.label || n.title || n.text || n.name,
          // Try parentId directly, then look up from edges
          parentId: n.parentId || n.parent_id || n.parent || findParentFromEdges(n.id, edges),
        }));
        
        if (mindmapNodes.length === 0) {
          return <ReportViewer title="Mind Map" content="No mind map nodes found in the data." />;
        }
        
        console.log('[StudioOutputViewer] Mind map nodes:', mindmapNodes.length, 'edges:', edges.length);
        
        return <MindMapViewer nodes={mindmapNodes} title={data?.title} />;

      case 'slides':
        const slides = (data?.slides || []).map((s: any, i: number) => {
          // Handle multiple content formats
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
          return <ReportViewer title="Presentation" content="No slides found in the data." />;
        }
        
        console.log('[StudioOutputViewer] Slides:', slides.length);
        
        return (
          <SlidesViewer 
            slides={slides} 
            title={data?.title}
            onDownload={handleSlidesDownload}
          />
        );

      case 'timeline':
        const events = (data?.events || data?.timeline || []).map((e: any, i: number) => ({
          id: e.id || `event_${i}`,
          date: e.date || e.year || e.time || '',
          title: e.title || e.event || e.name || '',
          description: e.description || e.content || '',
          details: e.details || e.significance,
        }));
        
        if (events.length === 0) {
          return <ReportViewer title="Timeline" content="No events found in the data." />;
        }
        
        return <TimelineViewer events={events} title={data?.title} />;

      case 'faq':
        const faqItems = (data?.questions || data?.faqs || data?.items || []).map((q: any, i: number) => ({
          id: q.id || `faq_${i}`,
          question: q.question || q.q,
          answer: q.answer || q.a,
        }));
        
        if (faqItems.length === 0) {
          return <ReportViewer title="FAQ" content="No FAQ items found in the data." />;
        }
        
        return <FAQViewer items={faqItems} title={data?.title} />;

      case 'table':
        // Transform to array of objects for DataTableViewer
        let tableData: Record<string, any>[] = [];
        
        if (data?.rows && data?.columns) {
          tableData = data.rows.map((row: any, i: number) => {
            const obj: Record<string, any> = {};
            // Handle both array rows and object rows with label/values
            if (Array.isArray(row)) {
              data.columns.forEach((col: string, j: number) => {
                obj[col] = row[j];
              });
            } else if (row.values) {
              obj['Label'] = row.label;
              data.columns.forEach((col: string, j: number) => {
                obj[col] = row.values[j];
              });
            } else {
              // Object row format
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
        
        return (
          <DataTableViewer 
            data={tableData} 
            columns={data?.columns}
            title={data?.title} 
          />
        );

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
        // Fallback for unknown types - show JSON
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
      {onClose && (
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
