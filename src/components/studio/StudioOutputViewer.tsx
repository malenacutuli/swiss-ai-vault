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

export function StudioOutputViewer({ type, data, onClose }: StudioOutputViewerProps) {
  const { toast } = useToast();

  // Generate and download PPTX from slides data
  const handleSlidesDownload = async () => {
    if (!data?.slides) return;
    
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

      for (const slide of data.slides) {
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

        // Content or Bullets
        const content = slide.bullets || (slide.content ? [slide.content] : []);
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
        if (slide.notes) {
          pptxSlide.addNotes(slide.notes);
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
        const quizQuestions = data?.questions?.map((q: any, i: number) => ({
          id: q.id || `q_${i}`,
          question: q.question,
          options: q.options || q.choices || [],
          correctIndex: q.correct_index ?? q.correctIndex ?? 0,
          explanation: q.explanation,
        })) || [];
        
        return <QuizViewer questions={quizQuestions} title={data?.title} />;

      case 'flashcards':
        const flashcards = data?.cards?.map((c: any, i: number) => ({
          id: c.id || `card_${i}`,
          front: c.front || c.question,
          back: c.back || c.answer,
        })) || [];
        
        return <FlashcardViewer cards={flashcards} title={data?.title} />;

      case 'mindmap':
        const mindmapNodes = data?.nodes?.map((n: any) => ({
          id: n.id,
          label: n.label || n.title || n.text,
          parentId: n.parentId || n.parent_id,
        })) || [];
        
        return <MindMapViewer nodes={mindmapNodes} title={data?.title} />;

      case 'slides':
        const slides = data?.slides?.map((s: any, i: number) => ({
          id: s.id || `slide_${i}`,
          title: s.title || `Slide ${i + 1}`,
          content: s.content || s.bullets?.join('\n') || '',
          notes: s.notes,
          imageUrl: s.imageUrl || s.image_url,
        })) || [];
        
        return (
          <SlidesViewer 
            slides={slides} 
            title={data?.title}
            onDownload={handleSlidesDownload}
          />
        );

      case 'timeline':
        const events = data?.events?.map((e: any, i: number) => ({
          id: e.id || `event_${i}`,
          date: e.date || e.year || '',
          title: e.title || e.event || '',
          description: e.description || '',
          details: e.details,
        })) || [];
        
        return <TimelineViewer events={events} title={data?.title} />;

      case 'faq':
        const faqItems = (data?.questions || data?.items || []).map((q: any, i: number) => ({
          id: q.id || `faq_${i}`,
          question: q.question,
          answer: q.answer,
        }));
        
        return <FAQViewer items={faqItems} title={data?.title} />;

      case 'table':
        // Transform to array of objects for DataTableViewer
        const tableData = data?.rows?.map((row: string[], i: number) => {
          const obj: Record<string, any> = {};
          data?.columns?.forEach((col: string, j: number) => {
            obj[col] = row[j];
          });
          return obj;
        }) || data?.data || [];
        
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
            content={data?.content}
            sections={data?.sections}
            citations={data?.citations}
          />
        );

      default:
        // Fallback for unknown types
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
