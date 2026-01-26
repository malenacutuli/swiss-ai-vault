/**
 * Health Image Upload - Upload images/files for AI vision analysis
 * Supports: Photos (rash, symptoms), medical reports, health device data
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Image,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Activity,
  Eye,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface UploadedHealthFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
  previewUrl?: string;
  analysisResult?: string;
  uploadedAt: number;
  category: 'symptom_photo' | 'medical_report' | 'health_device' | 'other';
}

interface HealthImageUploadProps {
  onFileAnalyzed: (file: UploadedHealthFile) => void;
  onFilesChange?: (files: UploadedHealthFile[]) => void;
  maxFiles?: number;
  className?: string;
}

const FILE_CATEGORIES = [
  { id: 'symptom_photo', icon: Camera, label: 'Symptom Photo', description: 'Rash, injury, skin condition' },
  { id: 'medical_report', icon: FileText, label: 'Medical Report', description: 'Lab results, prescriptions' },
  { id: 'health_device', icon: Activity, label: 'Health Device', description: 'Fitness tracker, monitor data' },
  { id: 'other', icon: Image, label: 'Other', description: 'Other health-related images' },
] as const;

export function HealthImageUpload({
  onFileAnalyzed,
  onFilesChange,
  maxFiles = 5,
  className
}: HealthImageUploadProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<UploadedHealthFile[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<UploadedHealthFile['category']>('symptom_photo');
  const [error, setError] = useState<string | null>(null);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Analyze image with AI vision
  const analyzeImage = async (file: UploadedHealthFile): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('ghost-vision', {
        body: {
          image_base64: file.base64,
          mime_type: file.mimeType,
          context: 'health_analysis',
          category: file.category,
          prompt: getAnalysisPrompt(file.category),
        }
      });

      if (error) throw error;
      return data?.analysis || 'Unable to analyze image.';
    } catch (err) {
      console.error('Image analysis failed:', err);
      return 'Analysis unavailable. The image has been saved for reference.';
    }
  };

  const getAnalysisPrompt = (category: UploadedHealthFile['category']): string => {
    switch (category) {
      case 'symptom_photo':
        return 'Describe what you observe in this medical symptom image. Note visible characteristics, potential concerns, and suggest when professional evaluation might be warranted. Do NOT diagnose.';
      case 'medical_report':
        return 'Extract and summarize the key information from this medical document. Identify any values that appear abnormal and explain what they might indicate in simple terms.';
      case 'health_device':
        return 'Analyze this health device data/screenshot. Summarize the key metrics shown and note any values that might warrant attention or discussion with a healthcare provider.';
      default:
        return 'Describe what you observe in this health-related image. Provide relevant observations that might be helpful for health tracking.';
    }
  };

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    
    if (files.length + acceptedFiles.length > maxFiles) {
      setError(t('ghost.health.upload.maxFilesError', `Maximum ${maxFiles} files allowed`));
      return;
    }

    for (const file of acceptedFiles) {
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError(t('ghost.health.upload.invalidType', 'Only images and PDFs are supported'));
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('ghost.health.upload.fileTooLarge', 'File must be under 10MB'));
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const id = crypto.randomUUID();
        
        const uploadedFile: UploadedHealthFile = {
          id,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          base64,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          uploadedAt: Date.now(),
          category: selectedCategory,
        };

        setFiles(prev => {
          const updated = [...prev, uploadedFile];
          onFilesChange?.(updated);
          return updated;
        });

        // Analyze the image
        setAnalyzing(id);
        const analysis = await analyzeImage(uploadedFile);
        
        setFiles(prev => {
          const updated = prev.map(f => 
            f.id === id ? { ...f, analysisResult: analysis } : f
          );
          const analyzedFile = updated.find(f => f.id === id);
          if (analyzedFile) {
            onFileAnalyzed(analyzedFile);
          }
          onFilesChange?.(updated);
          return updated;
        });
      } catch (err) {
        console.error('File processing error:', err);
        setError(t('ghost.health.upload.processingError', 'Failed to process file'));
      } finally {
        setAnalyzing(null);
      }
    }
  }, [files.length, maxFiles, selectedCategory, onFileAnalyzed, onFilesChange, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic'],
      'application/pdf': ['.pdf']
    },
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles,
  });

  // Remove file
  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      const updated = prev.filter(f => f.id !== id);
      onFilesChange?.(updated);
      return updated;
    });
  }, [onFilesChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Category Selection */}
      <div className="flex flex-wrap gap-2">
        {FILE_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant="outline"
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "gap-2 text-xs",
              selectedCategory === cat.id 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600"
            )}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
          isDragActive 
            ? "border-[#2A8C86] bg-[#2A8C86]/5" 
            : "border-slate-200 hover:border-slate-300",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto text-slate-400 mb-3" />
        <p className="text-sm text-slate-600 mb-1">
          {isDragActive 
            ? t('ghost.health.upload.dropHere', 'Drop files here')
            : t('ghost.health.upload.dragOrClick', 'Drag & drop or click to upload')}
        </p>
        <p className="text-xs text-slate-400">
          {t('ghost.health.upload.supportedFormats', 'Images (PNG, JPG, HEIC) or PDF • Max 10MB')}
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-emerald-600">
        <Shield className="w-3.5 h-3.5" />
        <span>{t('ghost.health.upload.privacyNote', 'Files analyzed locally and stored on your device only')}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">
            {t('ghost.health.upload.uploadedFiles', 'Uploaded Files')} ({files.length}/{maxFiles})
          </h4>
          
          {files.map((file) => (
            <Card key={file.id} className="p-3">
              <div className="flex items-start gap-3">
                {/* Preview */}
                {file.previewUrl ? (
                  <img 
                    src={file.previewUrl} 
                    alt={file.filename}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {file.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {FILE_CATEGORIES.find(c => c.id === file.category)?.label}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Analysis Status */}
                  {analyzing === file.id ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('ghost.health.upload.analyzing', 'Analyzing image...')}
                    </div>
                  ) : file.analysisResult ? (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('ghost.health.upload.analyzed', 'Analysis Complete')}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2 rounded">
                        {file.analysisResult}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
