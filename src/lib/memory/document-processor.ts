/**
 * Universal Document Processor
 * Extracts text from multiple file formats: PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, JSON
 */

export type SupportedFileType = 
  | 'pdf' 
  | 'docx' 
  | 'pptx' 
  | 'xlsx' 
  | 'txt' 
  | 'md' 
  | 'csv' 
  | 'json'
  | 'unknown';

export interface ProcessedDocument {
  content: string;
  metadata: {
    filename: string;
    fileType: SupportedFileType;
    pageCount?: number;
    wordCount: number;
    extractedAt: number;
    slideCount?: number;
    sheetCount?: number;
  };
  success: boolean;
  error?: string;
}

export interface ProcessingProgress {
  stage: 'reading' | 'extracting' | 'processing' | 'complete';
  percent: number;
  message: string;
}

/**
 * Detect file type from extension and MIME type
 */
export function detectFileType(file: File): SupportedFileType {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf': return 'pdf';
    case 'docx': 
    case 'doc': return 'docx';
    case 'pptx': 
    case 'ppt': return 'pptx';
    case 'xlsx': 
    case 'xls': return 'xlsx';
    case 'txt': return 'txt';
    case 'md': return 'md';
    case 'csv': return 'csv';
    case 'json': return 'json';
  }
  
  // Fallback to MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx';
  if (mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'pptx';
  if (mimeType.includes('spreadsheetml') || mimeType.includes('excel')) return 'xlsx';
  if (mimeType.includes('text/plain')) return 'txt';
  if (mimeType.includes('text/markdown')) return 'md';
  if (mimeType.includes('text/csv')) return 'csv';
  if (mimeType.includes('application/json')) return 'json';
  
  return 'unknown';
}

/**
 * Process any supported document file
 */
export async function processDocument(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessedDocument> {
  const fileType = detectFileType(file);
  
  onProgress?.({ stage: 'reading', percent: 10, message: 'Reading file...' });
  
  try {
    let content: string;
    let metadata: Partial<ProcessedDocument['metadata']> = {
      filename: file.name,
      fileType,
      extractedAt: Date.now()
    };
    
    switch (fileType) {
      case 'pdf':
        const pdfResult = await extractPDF(file, onProgress);
        content = pdfResult.content;
        metadata.pageCount = pdfResult.pageCount;
        break;
        
      case 'docx':
        content = await extractDOCX(file, onProgress);
        break;
        
      case 'pptx':
        const pptxResult = await extractPPTX(file, onProgress);
        content = pptxResult.content;
        metadata.slideCount = pptxResult.slideCount;
        break;
        
      case 'xlsx':
        const xlsxResult = await extractXLSX(file, onProgress);
        content = xlsxResult.content;
        metadata.sheetCount = xlsxResult.sheetCount;
        break;
        
      case 'txt':
      case 'md':
        content = await file.text();
        break;
        
      case 'csv':
        content = await extractCSV(file);
        break;
        
      case 'json':
        content = await extractJSON(file);
        break;
        
      default:
        // Try to read as text
        try {
          content = await file.text();
        } catch {
          throw new Error(`Unsupported file type: ${file.name}`);
        }
    }
    
    // Clean and validate content
    content = cleanContent(content);
    
    if (!content || content.trim().length === 0) {
      throw new Error('No text content could be extracted from this file');
    }
    
    metadata.wordCount = content.split(/\s+/).length;
    
    onProgress?.({ stage: 'complete', percent: 100, message: 'Done!' });
    
    return {
      content,
      metadata: metadata as ProcessedDocument['metadata'],
      success: true
    };
  } catch (error) {
    return {
      content: '',
      metadata: {
        filename: file.name,
        fileType,
        wordCount: 0,
        extractedAt: Date.now()
      },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract text from PDF using pdfjs-dist (legacy build)
 */
async function extractPDF(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ content: string; pageCount: number }> {
  // Dynamic import to avoid build issues
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pageCount = pdf.numPages;
  const maxPages = Math.min(pageCount, 50); // Limit to 50 pages
  const textParts: string[] = [];
  
  for (let i = 1; i <= maxPages; i++) {
    onProgress?.({
      stage: 'extracting',
      percent: 10 + Math.round((i / maxPages) * 80),
      message: `Extracting page ${i} of ${maxPages}...`
    });
    
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (pageText) {
      textParts.push(`--- Page ${i} ---\n${pageText}`);
    }
  }
  
  return {
    content: textParts.join('\n\n'),
    pageCount
  };
}

/**
 * Extract text from DOCX using mammoth
 */
async function extractDOCX(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'extracting', percent: 50, message: 'Extracting Word document...' });
  
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  return result.value;
}

/**
 * Extract text from PPTX by parsing the underlying XML
 */
async function extractPPTX(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ content: string; slideCount: number }> {
  onProgress?.({ stage: 'extracting', percent: 30, message: 'Extracting presentation...' });
  
  const JSZip = (await import('jszip')).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const slideTexts: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });
  
  for (let i = 0; i < slideFiles.length; i++) {
    onProgress?.({
      stage: 'extracting',
      percent: 30 + Math.round((i / slideFiles.length) * 60),
      message: `Extracting slide ${i + 1} of ${slideFiles.length}...`
    });
    
    const slideXml = await zip.file(slideFiles[i])?.async('string');
    if (slideXml) {
      const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .filter(text => text.trim())
        .join(' ');
      
      if (slideText.trim()) {
        slideTexts.push(`--- Slide ${i + 1} ---\n${slideText}`);
      }
    }
  }
  
  return {
    content: slideTexts.join('\n\n'),
    slideCount: slideFiles.length
  };
}

/**
 * Extract text from XLSX using xlsx library
 */
async function extractXLSX(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ content: string; sheetCount: number }> {
  onProgress?.({ stage: 'extracting', percent: 50, message: 'Extracting spreadsheet...' });
  
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetTexts: string[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    
    if (csv.trim()) {
      sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
  }
  
  return {
    content: sheetTexts.join('\n\n'),
    sheetCount: workbook.SheetNames.length
  };
}

/**
 * Extract text from CSV with header context
 */
async function extractCSV(file: File): Promise<string> {
  const text = await file.text();
  const lines = text.split('\n');
  if (lines.length > 0) {
    const header = lines[0];
    return `[CSV with columns: ${header}]\n${text}`;
  }
  return text;
}

/**
 * Extract text from JSON with formatting
 */
async function extractJSON(file: File): Promise<string> {
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    return `[JSON Document]\n${JSON.stringify(json, null, 2)}`;
  } catch {
    return text;
  }
}

/**
 * Clean extracted content
 */
function cleanContent(content: string): string {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Get accepted file types for dropzone
 */
export function getAcceptedFileTypes(): Record<string, string[]> {
  return {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/csv': ['.csv'],
    'application/json': ['.json']
  };
}

/**
 * Get human-readable list of supported formats
 */
export function getSupportedFormatsText(): string {
  return 'PDF, Word, PowerPoint, Excel, Text, Markdown, CSV, JSON';
}
