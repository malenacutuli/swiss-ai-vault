import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserClient, createBrowserClient } from '@/lib/agents/browser';
import type { BrowserActionResult, PageInfo } from '@/lib/agents/browser';
import { supabase } from '@/integrations/supabase/client';

interface UseBrowserOptions {
  taskId: string;
  userId: string;
  autoConnect?: boolean;
}

interface BrowserState {
  isConnected: boolean;
  isLoading: boolean;
  currentUrl: string | null;
  pageTitle: string | null;
  lastScreenshot: string | null;
  history: BrowserActionResult[];
  error: string | null;
}

interface UseBrowserReturn extends BrowserState {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Navigation
  navigate: (url: string) => Promise<BrowserActionResult>;
  back: () => Promise<BrowserActionResult>;
  forward: () => Promise<BrowserActionResult>;
  refresh: () => Promise<BrowserActionResult>;
  
  // Interaction
  click: (selector: string) => Promise<BrowserActionResult>;
  type: (selector: string, text: string) => Promise<BrowserActionResult>;
  
  // Content
  screenshot: (fullPage?: boolean) => Promise<BrowserActionResult>;
  extract: (type: 'text' | 'links' | 'images' | 'tables') => Promise<BrowserActionResult>;
  
  // State
  getPageInfo: () => Promise<PageInfo | null>;
  clearHistory: () => void;
}

export function useBrowser({
  taskId,
  userId,
  autoConnect = false,
}: UseBrowserOptions): UseBrowserReturn {
  const clientRef = useRef<BrowserClient | null>(null);
  
  const [state, setState] = useState<BrowserState>({
    isConnected: false,
    isLoading: false,
    currentUrl: null,
    pageTitle: null,
    lastScreenshot: null,
    history: [],
    error: null,
  });

  // Initialize client
  useEffect(() => {
    clientRef.current = createBrowserClient(taskId, userId);
    
    if (autoConnect) {
      connect();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.close();
      }
    };
  }, [taskId, userId]);

  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await clientRef.current.createSession();
      setState(prev => ({ ...prev, isConnected: true, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!clientRef.current) return;
    
    await clientRef.current.close();
    setState(prev => ({
      ...prev,
      isConnected: false,
      currentUrl: null,
      pageTitle: null,
    }));
  }, []);

  const executeAction = useCallback(async (
    action: () => Promise<BrowserActionResult>
  ): Promise<BrowserActionResult> => {
    if (!clientRef.current) {
      throw new Error('Browser client not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await action();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentUrl: result.data?.url || prev.currentUrl,
        pageTitle: result.data?.title || prev.pageTitle,
        lastScreenshot: result.data?.screenshot || prev.lastScreenshot,
        history: [...prev.history, result],
        error: result.success ? null : result.error || null,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Action failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const navigate = useCallback(async (url: string): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.navigate({ url }));
  }, [executeAction]);

  const back = useCallback(async (): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.back());
  }, [executeAction]);

  const forward = useCallback(async (): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.forward());
  }, [executeAction]);

  const refresh = useCallback(async (): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.refresh());
  }, [executeAction]);

  const click = useCallback(async (selector: string): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.click({ selector }));
  }, [executeAction]);

  const type = useCallback(async (selector: string, text: string): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.type({ selector, text }));
  }, [executeAction]);

  const screenshot = useCallback(async (fullPage = false): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.screenshot({ fullPage }));
  }, [executeAction]);

  const extract = useCallback(async (
    extractType: 'text' | 'links' | 'images' | 'tables'
  ): Promise<BrowserActionResult> => {
    return executeAction(() => clientRef.current!.extract({ extractType }));
  }, [executeAction]);

  const getPageInfo = useCallback(async (): Promise<PageInfo | null> => {
    if (!clientRef.current) return null;
    return clientRef.current.getPageInfo();
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, history: [] }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    navigate,
    back,
    forward,
    refresh,
    click,
    type,
    screenshot,
    extract,
    getPageInfo,
    clearHistory,
  };
}
