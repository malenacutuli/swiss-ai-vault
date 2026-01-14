// src/hooks/useDocumentSync.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Document {
  id: string;
  content: any;
  version: number;
  updated_at: string;
  updated_by: string;
}

interface UseDocumentSyncOptions {
  documentId: string;
  userId: string;
  onConflict?: (serverDoc: Document, localDoc: Document) => Document;
}

export function useDocumentSync({ documentId, userId, onConflict }: UseDocumentSyncOptions) {
  const [document, setDocument] = useState<Document | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const localVersionRef = useRef<number>(0);
  const pendingChangesRef = useRef<any>(null);

  // Fetch initial document
  useEffect(() => {
    if (!documentId) return;

    const fetchDocument = async () => {
      // Using type assertion since 'documents' table may not exist in schema yet
      const { data, error } = await (supabase.from('documents' as any) as any)
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        setLastSyncError(error.message);
        return;
      }

      const doc = data as Document;
      setDocument(doc);
      localVersionRef.current = doc.version;
    };

    fetchDocument();
  }, [documentId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!documentId) return;

    const channel = supabase
      .channel(`document:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        (payload) => {
          const serverDoc = payload.new as Document;

          // Ignore our own updates
          if (serverDoc.updated_by === userId) {
            localVersionRef.current = serverDoc.version;
            return;
          }

          // Check for conflict
          if (serverDoc.version > localVersionRef.current) {
            if (pendingChangesRef.current && onConflict) {
              // Resolve conflict
              const resolved = onConflict(serverDoc, {
                ...document!,
                content: pendingChangesRef.current
              });
              setDocument(resolved);
              pendingChangesRef.current = null;
            } else {
              setDocument(serverDoc);
            }
            localVersionRef.current = serverDoc.version;
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [documentId, userId, document, onConflict]);

  // Update document with optimistic locking
  const updateDocument = useCallback(async (content: any) => {
    if (!document) return { success: false, error: 'No document loaded' };

    setIsSyncing(true);
    pendingChangesRef.current = content;

    try {
      // Using type assertion since 'documents' table may not exist in schema yet
      const { data, error } = await (supabase.from('documents' as any) as any)
        .update({
          content,
          version: localVersionRef.current + 1,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', documentId)
        .eq('version', localVersionRef.current)  // Optimistic locking
        .select()
        .single();

      if (error) {
        // Conflict detected - refetch and retry
        if (error.code === 'PGRST116') {
          const { data: freshDoc } = await (supabase.from('documents' as any) as any)
            .select('*')
            .eq('id', documentId)
            .single();

          if (freshDoc && onConflict) {
            const fresh = freshDoc as Document;
            const resolved = onConflict(fresh, { ...document, content });
            await (supabase.from('documents' as any) as any)
              .update({
                content: resolved.content,
                version: fresh.version + 1,
                updated_at: new Date().toISOString(),
                updated_by: userId
              })
              .eq('id', documentId);

            setDocument(resolved);
            localVersionRef.current = fresh.version + 1;
          }
        } else {
          setLastSyncError(error.message);
          return { success: false, error: error.message };
        }
      } else if (data) {
        const doc = data as Document;
        setDocument(doc);
        localVersionRef.current = doc.version;
      }

      pendingChangesRef.current = null;
      setLastSyncError(null);
      return { success: true };

    } finally {
      setIsSyncing(false);
    }
  }, [document, documentId, userId, onConflict]);

  return {
    document,
    isSyncing,
    lastSyncError,
    updateDocument
  };
}
