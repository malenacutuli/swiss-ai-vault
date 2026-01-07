/**
 * File content extraction utility
 * Extracts text content from various file types for AI processing
 */

export async function extractFileContent(file: File): Promise<string> {
  const fileType = file.type || '';
  const fileName = file.name.toLowerCase();
  
  // Text-based files
  if (
    fileType.includes('text') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json')
  ) {
    return await file.text();
  }
  
  // PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // Use CDN worker for legacy build (version 4.0.379)
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let text = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) { // Limit to 50 pages
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text.trim();
    } catch (e: any) {
      console.error('PDF extraction failed:', e);
      // Graceful fallback - return filename with instruction
      return `[PDF Document: ${file.name} - ${file.size} bytes. PDF text extraction unavailable. Please paste key content manually or convert to .txt]`;
    }
  }
  
  // DOCX files
  if (fileName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (e: any) {
      console.error('DOCX extraction failed:', e);
      return `[Could not extract DOCX content: ${e.message}]`;
    }
  }
  
  // XLSX/XLS files
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheet')) {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `=== Sheet: ${sheetName} ===\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
      }
      return text.trim();
    } catch (e: any) {
      console.error('Excel extraction failed:', e);
      return `[Could not extract Excel content: ${e.message}]`;
    }
  }
  
  // Unknown - try as text
  try {
    return await file.text();
  } catch {
    return `[Could not extract content from ${file.name}]`;
  }
}

/**
 * Extract content from multiple files and format for AI prompt
 */
export async function extractFilesForPrompt(files: File[]): Promise<string> {
  if (files.length === 0) return '';
  
  let documentContext = '\n\n--- UPLOADED DOCUMENTS ---\n\n';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const content = await extractFileContent(file);
      documentContext += `=== Document ${i + 1}: ${file.name} ===\n`;
      documentContext += content.slice(0, 100000); // Limit per document
      documentContext += '\n\n';
    } catch (e) {
      documentContext += `=== Document ${i + 1}: ${file.name} ===\n`;
      documentContext += `[Error extracting content]\n\n`;
    }
  }
  
  documentContext += '--- END OF DOCUMENTS ---\n\n';
  return documentContext;
}
