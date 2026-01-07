import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceUploaderProps {
  onFilesUploaded: (files: File[]) => void;
  isUploading?: boolean;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function SourceUploader({ onFilesUploaded, isUploading = false }: SourceUploaderProps) {
  const [warning, setWarning] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setWarning(null);
    
    if (rejectedFiles.length > 0) {
      setWarning('Some files were rejected. Check file type and size.');
      return;
    }

    // Check for large XLSX files
    const xlsxFiles = acceptedFiles.filter(f => f.name.endsWith('.xlsx'));
    if (xlsxFiles.some(f => f.size > 10 * 1024 * 1024)) {
      setWarning('Large spreadsheets (>150k cells) may take longer to process.');
    }

    if (acceptedFiles.length > 0) {
      onFilesUploaded(acceptedFiles);
    }
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          isDragActive 
            ? 'border-[#e63946] bg-[#e63946]/10' 
            : 'border-white/20 hover:border-white/40 hover:bg-white/5',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-[#e63946] animate-spin" />
            <p className="text-sm text-white/60">Processing files...</p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-[#e63946]" />
            <p className="text-sm text-white">Drop files here</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-white/40" />
            <p className="text-sm text-white/60">
              Drag & drop files or click to upload
            </p>
            <p className="text-xs text-white/40">
              PDF, DOCX, XLSX, TXT, CSV, MD (max 50MB)
            </p>
          </div>
        )}
      </div>

      {warning && (
        <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500">{warning}</p>
        </div>
      )}
    </div>
  );
}
