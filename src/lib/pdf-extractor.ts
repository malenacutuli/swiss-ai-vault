/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files using pdf.js
 * Uses dynamic import to avoid top-level await build issues
 */

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  truncated: boolean;
}

const MAX_PAGES = 50; // Limit to first 50 pages
const MAX_TEXT_LENGTH = 100000; // ~25k tokens max

// Cache the loaded library
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjs) => {
      // Set the worker source for pdf.js
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  try {
    const pdfjsLib = await loadPdfJs();
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const pagesToProcess = Math.min(pageCount, MAX_PAGES);
    
    let fullText = '';
    let truncated = false;
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items with proper spacing
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (pageText) {
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
      }
      
      // Check if we've exceeded the max text length
      if (fullText.length > MAX_TEXT_LENGTH) {
        fullText = fullText.slice(0, MAX_TEXT_LENGTH);
        truncated = true;
        break;
      }
    }
    
    // If we didn't process all pages, mark as truncated
    if (pagesToProcess < pageCount) {
      truncated = true;
    }
    
    return {
      text: fullText.trim(),
      pageCount,
      truncated
    };
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
