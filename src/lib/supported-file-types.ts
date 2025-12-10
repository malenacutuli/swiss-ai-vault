// Supported file types with their handlers for document processing

export type FileHandler = 
  | 'claude-extract'  // PDF, DOCX, PPTX - send to Claude for extraction
  | 'direct-text'     // TXT, MD, JSON, YAML, code files - read directly
  | 'xlsx-parse'      // Excel files - parse with xlsx library
  | 'csv-parse'       // CSV files - parse as delimited text
  | 'claude-vision';  // Images - send to Claude for visual analysis

export interface FileTypeConfig {
  ext: string;
  handler: FileHandler;
  maxSize?: number; // Override default max size
}

export const SUPPORTED_FILE_TYPES: Record<string, FileTypeConfig> = {
  // Documents
  'application/pdf': { ext: '.pdf', handler: 'claude-extract' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', handler: 'claude-extract' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', handler: 'claude-extract' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', handler: 'xlsx-parse' },
  
  // Text
  'text/plain': { ext: '.txt', handler: 'direct-text' },
  'text/markdown': { ext: '.md', handler: 'direct-text' },
  'text/csv': { ext: '.csv', handler: 'csv-parse' },
  'application/json': { ext: '.json', handler: 'direct-text' },
  'text/yaml': { ext: '.yaml', handler: 'direct-text' },
  'application/x-yaml': { ext: '.yaml', handler: 'direct-text' },
  
  // Code
  'text/x-python': { ext: '.py', handler: 'direct-text' },
  'text/javascript': { ext: '.js', handler: 'direct-text' },
  'text/typescript': { ext: '.ts', handler: 'direct-text' },
  'application/typescript': { ext: '.ts', handler: 'direct-text' },
  'text/x-java': { ext: '.java', handler: 'direct-text' },
  'text/x-c': { ext: '.c', handler: 'direct-text' },
  'text/x-c++': { ext: '.cpp', handler: 'direct-text' },
  'text/html': { ext: '.html', handler: 'direct-text' },
  'text/css': { ext: '.css', handler: 'direct-text' },
  'application/xml': { ext: '.xml', handler: 'direct-text' },
  
  // Images (for visual analysis)
  'image/png': { ext: '.png', handler: 'claude-vision' },
  'image/jpeg': { ext: '.jpg', handler: 'claude-vision' },
  'image/webp': { ext: '.webp', handler: 'claude-vision' },
  'image/gif': { ext: '.gif', handler: 'claude-vision' },
};

// Extension-based lookup (fallback for when MIME type is unreliable)
export const EXTENSION_TO_CONFIG: Record<string, FileTypeConfig> = {
  // Documents
  '.pdf': { ext: '.pdf', handler: 'claude-extract' },
  '.docx': { ext: '.docx', handler: 'claude-extract' },
  '.pptx': { ext: '.pptx', handler: 'claude-extract' },
  '.xlsx': { ext: '.xlsx', handler: 'xlsx-parse' },
  '.xls': { ext: '.xls', handler: 'xlsx-parse' },
  
  // Text
  '.txt': { ext: '.txt', handler: 'direct-text' },
  '.md': { ext: '.md', handler: 'direct-text' },
  '.csv': { ext: '.csv', handler: 'csv-parse' },
  '.json': { ext: '.json', handler: 'direct-text' },
  '.yaml': { ext: '.yaml', handler: 'direct-text' },
  '.yml': { ext: '.yml', handler: 'direct-text' },
  
  // Code
  '.py': { ext: '.py', handler: 'direct-text' },
  '.js': { ext: '.js', handler: 'direct-text' },
  '.jsx': { ext: '.jsx', handler: 'direct-text' },
  '.ts': { ext: '.ts', handler: 'direct-text' },
  '.tsx': { ext: '.tsx', handler: 'direct-text' },
  '.java': { ext: '.java', handler: 'direct-text' },
  '.c': { ext: '.c', handler: 'direct-text' },
  '.cpp': { ext: '.cpp', handler: 'direct-text' },
  '.h': { ext: '.h', handler: 'direct-text' },
  '.hpp': { ext: '.hpp', handler: 'direct-text' },
  '.html': { ext: '.html', handler: 'direct-text' },
  '.css': { ext: '.css', handler: 'direct-text' },
  '.scss': { ext: '.scss', handler: 'direct-text' },
  '.xml': { ext: '.xml', handler: 'direct-text' },
  '.sql': { ext: '.sql', handler: 'direct-text' },
  '.sh': { ext: '.sh', handler: 'direct-text' },
  '.go': { ext: '.go', handler: 'direct-text' },
  '.rs': { ext: '.rs', handler: 'direct-text' },
  '.swift': { ext: '.swift', handler: 'direct-text' },
  '.kt': { ext: '.kt', handler: 'direct-text' },
  '.rb': { ext: '.rb', handler: 'direct-text' },
  '.php': { ext: '.php', handler: 'direct-text' },
  
  // Images
  '.png': { ext: '.png', handler: 'claude-vision' },
  '.jpg': { ext: '.jpg', handler: 'claude-vision' },
  '.jpeg': { ext: '.jpeg', handler: 'claude-vision' },
  '.webp': { ext: '.webp', handler: 'claude-vision' },
  '.gif': { ext: '.gif', handler: 'claude-vision' },
};

/**
 * Get file type config from MIME type or extension
 */
export function getFileConfig(file: File): FileTypeConfig | null {
  // Try MIME type first
  if (file.type && SUPPORTED_FILE_TYPES[file.type]) {
    return SUPPORTED_FILE_TYPES[file.type];
  }
  
  // Fallback to extension (more reliable for some file types)
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_TO_CONFIG[ext]) {
    return EXTENSION_TO_CONFIG[ext];
  }
  
  return null;
}

/**
 * Get all supported extensions for display
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_TO_CONFIG).map(ext => ext.replace('.', ''));
}

/**
 * Get accepted file types for dropzone
 */
export function getAcceptedFileTypes(): Record<string, string[]> {
  const accepted: Record<string, string[]> = {};
  
  for (const [mime, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    accepted[mime] = [config.ext];
  }
  
  return accepted;
}

/**
 * Check if file is supported
 */
export function isFileSupported(file: File): boolean {
  return getFileConfig(file) !== null;
}

/**
 * Get handler for file
 */
export function getFileHandler(file: File): FileHandler | null {
  const config = getFileConfig(file);
  return config?.handler ?? null;
}
