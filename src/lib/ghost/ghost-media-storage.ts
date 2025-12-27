/**
 * GhostMediaStorage - Venice-style local storage with SwissVault encryption
 * 
 * Philosophy: "You don't have to protect what you don't have"
 * Enhancement: "What you do have, we encrypt with AES-256-GCM"
 * 
 * All media (images, videos) stored ONLY in browser IndexedDB
 * Never sent to Supabase - prompts stay completely local
 */

const DB_NAME = 'ghost-media';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';
const VIDEOS_STORE = 'videos';

export interface LocalImage {
  id: string;
  data: string;        // base64 encoded image data
  prompt: string;      // STAYS LOCAL - never sent to server
  model: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: number;
  isFavorite?: boolean;
  aspectRatio?: string;
  seed?: number;
}

export interface LocalVideo {
  id: string;
  data?: string;       // base64 for short videos
  url?: string;        // fallback URL for large videos (may expire)
  thumbnailData?: string;
  prompt: string;      // STAYS LOCAL
  model: string;
  duration?: number;
  resolution?: string;
  createdAt: number;
  isFavorite?: boolean;
}

class GhostMediaStorage {
  private static instance: GhostMediaStorage | null = null;
  private db: IDBDatabase | null = null;
  private userId: string;
  private encryptionKey: CryptoKey | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor(userId: string) {
    this.userId = userId;
  }

  static async getInstance(userId: string): Promise<GhostMediaStorage> {
    if (!GhostMediaStorage.instance || GhostMediaStorage.instance.userId !== userId) {
      GhostMediaStorage.instance = new GhostMediaStorage(userId);
      await GhostMediaStorage.instance.init();
    }
    return GhostMediaStorage.instance;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      // Derive encryption key from user ID (same as chat storage for consistency)
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.userId),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const salt = encoder.encode(`swissvault_ghost_media_${this.userId}_v1`);
      this.encryptionKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // Open IndexedDB
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(`${DB_NAME}-${this.userId}`, DB_VERSION);
        
        request.onerror = () => {
          console.error('[GhostMediaStorage] Failed to open DB:', request.error);
          reject(request.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(IMAGES_STORE)) {
            const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('isFavorite', 'isFavorite', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
            const store = db.createObjectStore(VIDEOS_STORE, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('isFavorite', 'isFavorite', { unique: false });
          }
        };
        
        request.onsuccess = () => {
          this.db = request.result;
          this.isInitialized = true;
          console.log('[GhostMediaStorage] Initialized - Venice-style local storage ready');
          resolve();
        };
      });
    } catch (error) {
      console.error('[GhostMediaStorage] Init failed:', error);
      throw error;
    }
  }

  private async encrypt(data: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
      this.encryptionKey,
      new TextEncoder().encode(data)
    );
    return { ciphertext, iv };
  }

  private async decrypt(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');
    // Create a new Uint8Array with a proper ArrayBuffer to avoid SharedArrayBuffer issues
    const ivBuffer = new Uint8Array(iv);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      this.encryptionKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  /**
   * Venice-style: Download image from URL and store locally
   * Image is downloaded by BROWSER, stored encrypted in IndexedDB
   * URL and prompt NEVER touch Supabase
   */
  async downloadAndStoreImage(
    imageUrl: string, 
    prompt: string, 
    model: string,
    options?: { 
      showProgress?: (percent: number) => void;
      aspectRatio?: string;
      seed?: number;
    }
  ): Promise<LocalImage> {
    const id = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      options?.showProgress?.(10);
      
      // Download image blob (Venice pattern - browser does the download)
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';
      
      options?.showProgress?.(50);
      
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
      });
      
      options?.showProgress?.(75);
      
      // Create image object (prompt stays LOCAL)
      const imageData: LocalImage = {
        id,
        data: base64,
        prompt,      // Never sent to server
        model,
        mimeType,
        createdAt: Date.now(),
        isFavorite: false,
        aspectRatio: options?.aspectRatio,
        seed: options?.seed,
      };
      
      // Encrypt and store
      const { ciphertext, iv } = await this.encrypt(JSON.stringify(imageData));
      
      await this.storeEncrypted(IMAGES_STORE, id, ciphertext, iv);
      
      options?.showProgress?.(100);
      
      console.log(`[GhostMediaStorage] Image stored locally in ${Date.now() - startTime}ms`);
      return imageData;
      
    } catch (error) {
      console.error('[GhostMediaStorage] Download failed:', error);
      throw error;
    }
  }

  /**
   * Store from existing base64 (for reference images, etc.)
   */
  async storeImageFromBase64(
    base64Data: string,
    prompt: string,
    model: string,
    mimeType: string = 'image/png'
  ): Promise<LocalImage> {
    const id = crypto.randomUUID();
    
    const imageData: LocalImage = {
      id,
      data: base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`,
      prompt,
      model,
      mimeType,
      createdAt: Date.now(),
      isFavorite: false,
    };
    
    const { ciphertext, iv } = await this.encrypt(JSON.stringify(imageData));
    await this.storeEncrypted(IMAGES_STORE, id, ciphertext, iv);
    
    return imageData;
  }

  private async storeEncrypted(
    storeName: string, 
    id: string, 
    ciphertext: ArrayBuffer, 
    iv: Uint8Array
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      // Store as base64 strings for IndexedDB compatibility
      const record = {
        id,
        ciphertext: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv.buffer),
        updatedAt: Date.now(),
      };
      
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get all images, decrypted and sorted by date
   */
  async getImages(): Promise<LocalImage[]> {
    return this.getAllFromStore<LocalImage>(IMAGES_STORE);
  }

  /**
   * Get all videos
   */
  async getVideos(): Promise<LocalVideo[]> {
    return this.getAllFromStore<LocalVideo>(VIDEOS_STORE);
  }

  private async getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = async () => {
        try {
          const results: (T | null)[] = await Promise.all(
            request.result.map(async (record: any): Promise<T | null> => {
              try {
                const ciphertext = this.base64ToArrayBuffer(record.ciphertext);
                const iv = new Uint8Array(this.base64ToArrayBuffer(record.iv));
                const decrypted = await this.decrypt(ciphertext, iv);
                return JSON.parse(decrypted) as T;
              } catch (e) {
                console.warn('[GhostMediaStorage] Failed to decrypt item:', record.id);
                return null;
              }
            })
          );
          
          // Filter nulls and sort by createdAt descending
          const valid = results.filter((r): r is T => r !== null);
          valid.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(valid);
        } catch (error) {
          console.error('[GhostMediaStorage] Decryption error:', error);
          resolve([]);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single image by ID
   */
  async getImage(id: string): Promise<LocalImage | null> {
    const images = await this.getImages();
    return images.find(img => img.id === id) || null;
  }

  /**
   * Delete an image
   */
  async deleteImage(id: string): Promise<void> {
    return this.deleteFromStore(IMAGES_STORE, id);
  }

  /**
   * Delete a video
   */
  async deleteVideo(id: string): Promise<void> {
    return this.deleteFromStore(VIDEOS_STORE, id);
  }

  private async deleteFromStore(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      
      tx.oncomplete = () => {
        console.log(`[GhostMediaStorage] Deleted ${id} from ${storeName}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string, type: 'image' | 'video'): Promise<boolean> {
    const storeName = type === 'image' ? IMAGES_STORE : VIDEOS_STORE;
    const items = type === 'image' ? await this.getImages() : await this.getVideos();
    const item = items.find((i: any) => i.id === id);
    
    if (!item) return false;
    
    (item as any).isFavorite = !(item as any).isFavorite;
    
    const { ciphertext, iv } = await this.encrypt(JSON.stringify(item));
    await this.storeEncrypted(storeName, id, ciphertext, iv);
    
    return (item as any).isFavorite;
  }

  /**
   * Store video - for large videos, store URL; for small ones, store data
   */
  async storeVideo(
    videoUrl: string,
    prompt: string,
    model: string,
    options?: { duration?: number; resolution?: string; downloadIfSmall?: boolean }
  ): Promise<LocalVideo> {
    const id = crypto.randomUUID();
    
    let videoData: LocalVideo = {
      id,
      url: videoUrl,  // Keep URL for now (videos are large)
      prompt,         // Stays local
      model,
      duration: options?.duration,
      resolution: options?.resolution,
      createdAt: Date.now(),
      isFavorite: false,
    };
    
    // For small videos, try to download and store locally
    if (options?.downloadIfSmall) {
      try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        
        // Only store locally if under 50MB
        if (blob.size < 50 * 1024 * 1024) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          videoData.data = base64;
          videoData.url = undefined; // Don't need URL if we have data
        }
      } catch (e) {
        console.warn('[GhostMediaStorage] Could not download video, keeping URL');
      }
    }
    
    const { ciphertext, iv } = await this.encrypt(JSON.stringify(videoData));
    await this.storeEncrypted(VIDEOS_STORE, id, ciphertext, iv);
    
    console.log('[GhostMediaStorage] Video stored locally');
    return videoData;
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{ imageCount: number; videoCount: number; estimatedSizeMB: number }> {
    const images = await this.getImages();
    const videos = await this.getVideos();
    
    // Estimate size from base64 data
    let totalBytes = 0;
    for (const img of images) {
      totalBytes += (img.data?.length || 0) * 0.75; // base64 is ~33% larger
    }
    for (const vid of videos) {
      totalBytes += (vid.data?.length || 0) * 0.75;
    }
    
    return {
      imageCount: images.length,
      videoCount: videos.length,
      estimatedSizeMB: Math.round(totalBytes / (1024 * 1024) * 10) / 10,
    };
  }

  /**
   * Clear all media (for "Clear Library" feature)
   */
  async clearAll(): Promise<void> {
    if (!this.db) return;
    
    const tx = this.db.transaction([IMAGES_STORE, VIDEOS_STORE], 'readwrite');
    tx.objectStore(IMAGES_STORE).clear();
    tx.objectStore(VIDEOS_STORE).clear();
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('[GhostMediaStorage] All media cleared');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}

export { GhostMediaStorage };
