import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GhostMediaStorage, LocalImage, LocalVideo } from '@/lib/ghost/ghost-media-storage';
import { toast } from 'sonner';

export function useGhostMedia() {
  const { user } = useAuth();
  const [storage, setStorage] = useState<GhostMediaStorage | null>(null);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [videos, setVideos] = useState<LocalVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ imageCount: 0, videoCount: 0, estimatedSizeMB: 0 });
  const initRef = useRef(false);

  // Initialize storage when user is available
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    if (initRef.current) return;
    initRef.current = true;
    
    GhostMediaStorage.getInstance(userId)
      .then(instance => {
        setStorage(instance);
        console.log('[useGhostMedia] Storage initialized');
      })
      .catch(error => {
        console.error('[useGhostMedia] Failed to initialize:', error);
        initRef.current = false;
        setIsLoading(false);
      });
    
    return () => {
      initRef.current = false;
    };
  }, [user?.id]);

  // Load content when storage is ready
  useEffect(() => {
    if (!storage) return;
    
    const loadContent = async () => {
      setIsLoading(true);
      try {
        const [imgs, vids, info] = await Promise.all([
          storage.getImages(),
          storage.getVideos(),
          storage.getStorageInfo(),
        ]);
        setImages(imgs);
        setVideos(vids);
        setStorageInfo(info);
      } catch (error) {
        console.error('[useGhostMedia] Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadContent();
  }, [storage]);

  /**
   * Venice-style: Download image from URL and store locally
   * Returns the local image object for immediate display
   */
  const saveImage = useCallback(async (
    imageUrl: string, 
    prompt: string, 
    model: string,
    options?: { 
      showProgress?: (percent: number) => void;
      aspectRatio?: string;
      seed?: number;
    }
  ): Promise<LocalImage | null> => {
    if (!storage) {
      console.warn('[useGhostMedia] Storage not ready');
      return null;
    }
    
    try {
      const localImage = await storage.downloadAndStoreImage(imageUrl, prompt, model, options);
      
      // Update state immediately for responsive UI
      setImages(prev => [localImage, ...prev]);
      setStorageInfo(prev => ({ 
        ...prev, 
        imageCount: prev.imageCount + 1 
      }));
      
      return localImage;
    } catch (error) {
      console.error('[useGhostMedia] saveImage failed:', error);
      toast.error('Failed to save image locally');
      return null;
    }
  }, [storage]);

  /**
   * Delete image from local storage
   */
  const deleteImage = useCallback(async (id: string): Promise<boolean> => {
    if (!storage) return false;
    
    try {
      await storage.deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
      setStorageInfo(prev => ({ ...prev, imageCount: Math.max(0, prev.imageCount - 1) }));
      return true;
    } catch (error) {
      console.error('[useGhostMedia] deleteImage failed:', error);
      toast.error('Failed to delete image');
      return false;
    }
  }, [storage]);

  /**
   * Save video locally
   */
  const saveVideo = useCallback(async (
    videoUrl: string, 
    prompt: string, 
    model: string,
    options?: { duration?: number; resolution?: string }
  ): Promise<LocalVideo | null> => {
    if (!storage) return null;
    
    try {
      const localVideo = await storage.storeVideo(videoUrl, prompt, model, options);
      setVideos(prev => [localVideo, ...prev]);
      setStorageInfo(prev => ({ ...prev, videoCount: prev.videoCount + 1 }));
      return localVideo;
    } catch (error) {
      console.error('[useGhostMedia] saveVideo failed:', error);
      toast.error('Failed to save video locally');
      return null;
    }
  }, [storage]);

  /**
   * Delete video from local storage
   */
  const deleteVideo = useCallback(async (id: string): Promise<boolean> => {
    if (!storage) return false;
    
    try {
      await storage.deleteVideo(id);
      setVideos(prev => prev.filter(vid => vid.id !== id));
      setStorageInfo(prev => ({ ...prev, videoCount: Math.max(0, prev.videoCount - 1) }));
      return true;
    } catch (error) {
      console.error('[useGhostMedia] deleteVideo failed:', error);
      toast.error('Failed to delete video');
      return false;
    }
  }, [storage]);

  /**
   * Toggle favorite
   */
  const toggleFavorite = useCallback(async (id: string, type: 'image' | 'video'): Promise<boolean> => {
    if (!storage) return false;
    
    const newStatus = await storage.toggleFavorite(id, type);
    
    if (type === 'image') {
      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, isFavorite: newStatus } : img
      ));
    } else {
      setVideos(prev => prev.map(vid => 
        vid.id === id ? { ...vid, isFavorite: newStatus } : vid
      ));
    }
    
    return newStatus;
  }, [storage]);

  /**
   * Clear all media
   */
  const clearAll = useCallback(async (): Promise<void> => {
    if (!storage) return;
    
    await storage.clearAll();
    setImages([]);
    setVideos([]);
    setStorageInfo({ imageCount: 0, videoCount: 0, estimatedSizeMB: 0 });
    toast.success('Library cleared');
  }, [storage]);

  /**
   * Refresh from storage
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!storage) return;
    
    const [imgs, vids, info] = await Promise.all([
      storage.getImages(),
      storage.getVideos(),
      storage.getStorageInfo(),
    ]);
    setImages(imgs);
    setVideos(vids);
    setStorageInfo(info);
  }, [storage]);

  return {
    images,
    videos,
    isLoading,
    storageInfo,
    saveImage,
    deleteImage,
    saveVideo,
    deleteVideo,
    toggleFavorite,
    clearAll,
    refresh,
    isReady: storage !== null,
  };
}

export type { LocalImage, LocalVideo };
