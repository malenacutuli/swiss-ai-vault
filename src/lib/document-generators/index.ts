// Export all document generators
export { 
  generatePPTX, 
  downloadPPTX, 
  uploadPPTX,
  type SlideContent, 
  type PPTXOptions 
} from './pptx-generator';

export { 
  generateDOCX, 
  downloadDOCX, 
  uploadDOCX,
  type DocSection, 
  type DOCXOptions 
} from './docx-generator';

export { 
  generateXLSX, 
  downloadXLSX, 
  uploadXLSX,
  type XLSXOptions 
} from './xlsx-generator';

export { 
  DocumentGeneratorService,
  type GeneratedDocument 
} from './document-service';
