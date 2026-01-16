import { generatePPTX, downloadPPTX, SlideContent, PPTXOptions } from './pptx-generator';
import { generateDOCX, downloadDOCX, DocSection, DOCXOptions } from './docx-generator';
import { generateXLSX, downloadXLSX, XLSXOptions } from './xlsx-generator';
import { supabase } from '@/integrations/supabase/client';

export interface GeneratedDocument {
  blob: Blob;
  filename: string;
  format: string;
}

export class DocumentGeneratorService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async generateFromAgentOutput(output: any): Promise<GeneratedDocument | null> {
    const targetFormat = output.metadata?.target_type || output.target_format;
    let data = output.data;

    // Fetch data if not embedded
    if (!data && output.file_url) {
      data = await this.fetchOutputData(output.file_url);
    }

    if (!data || !targetFormat) {
      console.error('[DocumentService] Missing data or target format');
      return null;
    }

    console.log(`[DocumentService] Generating ${targetFormat} from data`);

    switch (targetFormat) {
      case 'pptx':
        return this.generatePPTXFromData(data);
      case 'docx':
        return this.generateDOCXFromData(data);
      case 'xlsx':
        return this.generateXLSXFromData(data);
      default:
        console.error('[DocumentService] Unknown format:', targetFormat);
        return null;
    }
  }

  private async fetchOutputData(url: string): Promise<any> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[DocumentService] Failed to fetch data:', err);
      return null;
    }
  }

  private async generatePPTXFromData(data: any): Promise<GeneratedDocument> {
    const slides: SlideContent[] = data.slides || [];
    const options: PPTXOptions = {
      title: data.title || 'Presentation',
      subtitle: data.subtitle,
      author: 'SwissBrAIn AI',
      theme: 'swiss',
    };

    const blob = await generatePPTX(slides, options);
    const safeName = (data.title || 'presentation').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}-${Date.now()}.pptx`;

    return { blob, filename, format: 'pptx' };
  }

  private async generateDOCXFromData(data: any): Promise<GeneratedDocument> {
    // Convert slides to sections if that's what we have
    let sections: DocSection[] = data.sections || [];
    
    if (sections.length === 0 && data.slides) {
      sections = data.slides.map((slide: any) => ({
        title: slide.title || 'Section',
        content: Array.isArray(slide.content) ? slide.content : [slide.content || ''],
        level: 2,
      }));
    }

    if (sections.length === 0 && data.content) {
      sections = [
        {
          title: 'Content',
          content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
          level: 1,
        },
      ];
    }

    const options: DOCXOptions = {
      title: data.title || 'Document',
      subtitle: data.subtitle,
      author: 'SwissBrAIn AI',
    };

    const blob = await generateDOCX(sections, options);
    const safeName = (data.title || 'document').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}-${Date.now()}.docx`;

    return { blob, filename, format: 'docx' };
  }

  private async generateXLSXFromData(data: any): Promise<GeneratedDocument> {
    let rows: any[][] = data.rows || [];

    // Try to convert content to rows if no rows provided
    if (rows.length === 0 && data.content) {
      if (Array.isArray(data.content)) {
        rows = data.content.map((item: any) => {
          if (Array.isArray(item)) return item;
          if (typeof item === 'object') return Object.values(item);
          return [item];
        });
      }
    }

    const options: XLSXOptions = {
      title: data.title || 'Spreadsheet',
      headers: data.headers,
      sheetName: data.sheetName || 'Data',
    };

    const blob = await generateXLSX(rows, options);
    const safeName = (data.title || 'spreadsheet').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}-${Date.now()}.xlsx`;

    return { blob, filename, format: 'xlsx' };
  }

  async uploadGeneratedDocument(
    blob: Blob,
    filename: string,
    outputId?: string
  ): Promise<string | null> {
    try {
      const filePath = `${this.userId}/documents/${filename}`;

      const { error } = await supabase.storage
        .from('agent-outputs')
        .upload(filePath, blob, {
          contentType: this.getMimeType(filename),
          upsert: true,
        });

      if (error) {
        console.error('[DocumentService] Upload failed:', error);
        return null;
      }

      const { data } = supabase.storage
        .from('agent-outputs')
        .getPublicUrl(filePath);

      // Update output record if provided
      if (outputId) {
        await supabase
          .from('agent_outputs')
          .update({
            download_url: data.publicUrl,
            file_name: filename,
            file_path: filePath,
            actual_format: this.getExtension(filename),
            conversion_status: 'complete',
          })
          .eq('id', outputId);
      }

      return data.publicUrl;
    } catch (err) {
      console.error('[DocumentService] Upload exception:', err);
      return null;
    }
  }

  downloadDocument(blob: Blob, filename: string): void {
    const ext = this.getExtension(filename);
    switch (ext) {
      case 'pptx':
        downloadPPTX(blob, filename);
        break;
      case 'docx':
        downloadDOCX(blob, filename);
        break;
      case 'xlsx':
        downloadXLSX(blob, filename);
        break;
      default:
        // Generic download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  }

  private getMimeType(filename: string): string {
    const ext = this.getExtension(filename);
    const mimes: Record<string, string> = {
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      md: 'text/markdown',
    };
    return mimes[ext] || 'application/octet-stream';
  }

  private getExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }
}
