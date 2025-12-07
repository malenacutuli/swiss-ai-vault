import { useState, useCallback, useRef, useEffect } from 'react';
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';

// File size thresholds
const TUS_THRESHOLD = 6 * 1024 * 1024; // 6MB - use TUS for larger files
const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks (Supabase limit)

// File size limits by tier
export const FILE_SIZE_LIMITS = {
  free: 50 * 1024 * 1024,      // 50 MB
  pro: 500 * 1024 * 1024,      // 500 MB
  enterprise: 1000 * 1024 * 1024, // 1 GB
} as const;

export type UserTier = keyof typeof FILE_SIZE_LIMITS;

export type UploadStatus = 
  | 'idle' 
  | 'preparing' 
  | 'uploading' 
  | 'paused' 
  | 'complete' 
  | 'error'
  | 'resuming';

interface UploadProgress {
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  currentChunk: number;
  totalChunks: number;
  estimatedTimeRemaining: number | null; // in seconds
  speed: number; // bytes per second
}

interface ResumableUploadOptions {
  bucket: string;
  path: string;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (storagePath: string) => void;
  onError?: (error: Error) => void;
  userTier?: UserTier;
}

interface StoredUpload {
  id: string;
  filename: string;
  bucket: string;
  path: string;
  url: string;
  bytesUploaded: number;
  bytesTotal: number;
  createdAt: number;
}

const STORAGE_KEY = 'swissvault_incomplete_uploads';

// Get stored incomplete uploads
const getStoredUploads = (): StoredUpload[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save upload state
const saveUploadState = (upload: StoredUpload) => {
  const uploads = getStoredUploads();
  const existing = uploads.findIndex(u => u.id === upload.id);
  if (existing >= 0) {
    uploads[existing] = upload;
  } else {
    uploads.push(upload);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
};

// Remove upload state
const removeUploadState = (id: string) => {
  const uploads = getStoredUploads().filter(u => u.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
};

// Clear old uploads (older than 7 days)
const cleanOldUploads = () => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const uploads = getStoredUploads().filter(u => u.createdAt > sevenDaysAgo);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
};

export function useResumableUpload(options: ResumableUploadOptions) {
  const { bucket, path, onProgress, onComplete, onError, userTier = 'free' } = options;

  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState<UploadProgress>({
    percentage: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
    currentChunk: 0,
    totalChunks: 0,
    estimatedTimeRemaining: null,
    speed: 0,
  });
  const [error, setError] = useState<Error | null>(null);
  const [incompleteUploads, setIncompleteUploads] = useState<StoredUpload[]>([]);

  const uploadRef = useRef<tus.Upload | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastBytesRef = useRef<number>(0);
  const speedSamplesRef = useRef<number[]>([]);

  // Clean old uploads on mount
  useEffect(() => {
    cleanOldUploads();
    setIncompleteUploads(getStoredUploads());
  }, []);

  // Browser close warning during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'uploading') {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  // Calculate upload speed and ETA
  const calculateProgress = useCallback((bytesUploaded: number, bytesTotal: number) => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const bytesPerSecond = elapsed > 0 ? bytesUploaded / elapsed : 0;

    // Keep last 5 speed samples for smoothing
    speedSamplesRef.current.push(bytesPerSecond);
    if (speedSamplesRef.current.length > 5) {
      speedSamplesRef.current.shift();
    }
    const avgSpeed = speedSamplesRef.current.reduce((a, b) => a + b, 0) / speedSamplesRef.current.length;

    const remaining = bytesTotal - bytesUploaded;
    const eta = avgSpeed > 0 ? remaining / avgSpeed : null;

    const currentChunk = Math.ceil(bytesUploaded / CHUNK_SIZE);
    const totalChunks = Math.ceil(bytesTotal / CHUNK_SIZE);

    const newProgress: UploadProgress = {
      percentage: Math.round((bytesUploaded / bytesTotal) * 100),
      bytesUploaded,
      bytesTotal,
      currentChunk,
      totalChunks,
      estimatedTimeRemaining: eta,
      speed: avgSpeed,
    };

    setProgress(newProgress);
    lastBytesRef.current = bytesUploaded;
    onProgress?.(newProgress);
  }, [onProgress]);

  // Standard Supabase upload for small files
  const uploadStandard = useCallback(async (file: File, storagePath: string) => {
    setStatus('uploading');
    startTimeRef.current = Date.now();

    try {
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      setProgress({
        percentage: 100,
        bytesUploaded: file.size,
        bytesTotal: file.size,
        currentChunk: 1,
        totalChunks: 1,
        estimatedTimeRemaining: 0,
        speed: 0,
      });
      setStatus('complete');
      onComplete?.(data.path);
      return data.path;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      setError(error);
      setStatus('error');
      onError?.(error);
      throw error;
    }
  }, [bucket, onComplete, onError]);

  // TUS resumable upload for large files
  const uploadTUS = useCallback(async (file: File, storagePath: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    const uploadId = `${bucket}/${storagePath}/${Date.now()}`;
    uploadIdRef.current = uploadId;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

    return new Promise<string>((resolve, reject) => {
      setStatus('preparing');
      startTimeRef.current = Date.now();
      speedSamplesRef.current = [];

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: CHUNK_SIZE,
        parallelUploads: 3,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: bucket,
          objectName: storagePath,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError: (err) => {
          // Save state for resume
          if (uploadRef.current) {
            const url = uploadRef.current.url;
            if (url) {
              saveUploadState({
                id: uploadId,
                filename: file.name,
                bucket,
                path: storagePath,
                url,
                bytesUploaded: progress.bytesUploaded,
                bytesTotal: file.size,
                createdAt: Date.now(),
              });
              setIncompleteUploads(getStoredUploads());
            }
          }
          
          const error = err instanceof Error ? err : new Error('TUS upload failed');
          setError(error);
          setStatus('error');
          onError?.(error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          setStatus('uploading');
          calculateProgress(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          removeUploadState(uploadId);
          setIncompleteUploads(getStoredUploads());
          setStatus('complete');
          onComplete?.(storagePath);
          resolve(storagePath);
        },
      });

      uploadRef.current = upload;

      // Check for previous upload
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  }, [bucket, calculateProgress, onComplete, onError, progress.bytesUploaded]);

  // Main upload function
  const upload = useCallback(async (file: File) => {
    // Validate file size against tier limit
    const maxSize = FILE_SIZE_LIMITS[userTier];
    if (file.size > maxSize) {
      const error = new Error(
        `File too large. Max size for ${userTier} tier: ${Math.round(maxSize / (1024 * 1024))}MB`
      );
      setError(error);
      setStatus('error');
      onError?.(error);
      throw error;
    }

    setError(null);
    setProgress({
      percentage: 0,
      bytesUploaded: 0,
      bytesTotal: file.size,
      currentChunk: 0,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      estimatedTimeRemaining: null,
      speed: 0,
    });

    const storagePath = `${path}/${file.name}`;

    // Use TUS for files larger than 6MB, standard upload for smaller files
    if (file.size > TUS_THRESHOLD) {
      return uploadTUS(file, storagePath);
    } else {
      return uploadStandard(file, storagePath);
    }
  }, [path, userTier, uploadTUS, uploadStandard, onError]);

  // Pause upload
  const pause = useCallback(() => {
    if (uploadRef.current && status === 'uploading') {
      uploadRef.current.abort();
      setStatus('paused');

      // Save state for later resume
      if (uploadIdRef.current && uploadRef.current.url) {
        const file = uploadRef.current.file;
        const filename = file instanceof File ? file.name : 'unknown';
        saveUploadState({
          id: uploadIdRef.current,
          filename,
          bucket,
          path,
          url: uploadRef.current.url,
          bytesUploaded: progress.bytesUploaded,
          bytesTotal: progress.bytesTotal,
          createdAt: Date.now(),
        });
        setIncompleteUploads(getStoredUploads());
      }
    }
  }, [status, bucket, path, progress]);

  // Resume upload
  const resume = useCallback(() => {
    if (uploadRef.current && status === 'paused') {
      setStatus('resuming');
      startTimeRef.current = Date.now() - (progress.bytesUploaded / (progress.speed || 1)) * 1000;
      uploadRef.current.start();
    }
  }, [status, progress]);

  // Resume from stored incomplete upload
  const resumeFromStored = useCallback(async (storedUpload: StoredUpload, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

    return new Promise<string>((resolve, reject) => {
      setStatus('resuming');
      startTimeRef.current = Date.now();
      speedSamplesRef.current = [];
      uploadIdRef.current = storedUpload.id;

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: CHUNK_SIZE,
        parallelUploads: 3,
        uploadUrl: storedUpload.url,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: storedUpload.bucket,
          objectName: storedUpload.path,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError: (err) => {
          const error = err instanceof Error ? err : new Error('Resume failed');
          setError(error);
          setStatus('error');
          onError?.(error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          setStatus('uploading');
          calculateProgress(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          removeUploadState(storedUpload.id);
          setIncompleteUploads(getStoredUploads());
          setStatus('complete');
          onComplete?.(storedUpload.path);
          resolve(storedUpload.path);
        },
      });

      uploadRef.current = upload;
      upload.start();
    });
  }, [calculateProgress, onComplete, onError]);

  // Cancel upload
  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      if (uploadIdRef.current) {
        removeUploadState(uploadIdRef.current);
        setIncompleteUploads(getStoredUploads());
      }
    }
    setStatus('idle');
    setProgress({
      percentage: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      currentChunk: 0,
      totalChunks: 0,
      estimatedTimeRemaining: null,
      speed: 0,
    });
    setError(null);
    uploadRef.current = null;
    uploadIdRef.current = null;
  }, []);

  // Clear a specific incomplete upload
  const clearIncomplete = useCallback((id: string) => {
    removeUploadState(id);
    setIncompleteUploads(getStoredUploads());
  }, []);

  return {
    upload,
    pause,
    resume,
    resumeFromStored,
    cancel,
    clearIncomplete,
    status,
    progress,
    error,
    incompleteUploads,
    isLargeFile: (file: File) => file.size > TUS_THRESHOLD,
    canPauseResume: (file: File) => file.size > 50 * 1024 * 1024, // 50MB
  };
}

// Helper to format bytes
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to format time
export function formatTime(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return '--:--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
