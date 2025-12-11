import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEncryption } from './useEncryption';
import { useZeroRetentionMode } from './useZeroRetentionMode';
import { toast } from 'sonner';

export interface ResearchCitation {
  url: string;
  title: string;
  snippet?: string;
}

export interface ResearchResult {
  content: string;
  citations: ResearchCitation[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    searchQueries: number;
    reasoningTokens?: number;
  };
  cost: number;
  processingTime: number;
  researchQueryId: string;
  isEncrypted: boolean;
}

export interface ResearchQuota {
  tier: string;
  limit: number;
  used: number;
  remaining: number;
}

type ResearchStage = 'idle' | 'encrypting' | 'searching' | 'analyzing' | 'synthesizing' | 'decrypting' | 'complete';

export function useEncryptedDeepResearch() {
  const { data: isZeroTraceEnabled = false } = useZeroRetentionMode();
  const { encryptMessage, decryptMessage, isUnlocked } = useEncryption();
  
  const [isResearching, setIsResearching] = useState(false);
  const [stage, setStage] = useState<ResearchStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<ResearchQuota | null>(null);

  // Fetch current quota
  const fetchQuota = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_research_quota');
      if (error) throw error;
      const quotaData = data as unknown as ResearchQuota;
      setQuota(quotaData);
      return quotaData;
    } catch (err) {
      console.error('Failed to fetch quota:', err);
      return null;
    }
  }, []);

  // Main research function
  const research = useCallback(async (
    query: string,
    conversationId?: string,
    documentIds?: string[]
  ): Promise<ResearchResult | null> => {
    // Check if vault is unlocked when ZeroTrace is enabled
    if (isZeroTraceEnabled && !isUnlocked) {
      setError('Please unlock your vault to use encrypted research');
      toast.error('Vault must be unlocked for encrypted research');
      return null;
    }

    setIsResearching(true);
    setError(null);
    setProgress(0);

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let queryEncrypted: string | undefined;
      let queryNonce: string | undefined;

      // Step 1: Encrypt query if ZeroTrace is enabled
      if (isZeroTraceEnabled && conversationId) {
        setStage('encrypting');
        setProgress(10);
        
        const encrypted = await encryptMessage(conversationId, query);
        queryEncrypted = encrypted.ciphertext;
        queryNonce = encrypted.nonce;
      }

      // Step 2: Call the Edge Function
      setStage('searching');
      setProgress(25);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/encrypted-deep-research`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            queryEncrypted,
            queryNonce,
            queryPlaintext: query, // Always send plaintext for API call
            conversationId,
            isZeroTraceEnabled,
            includeDocuments: documentIds && documentIds.length > 0,
            documentIds
          })
        }
      );

      setStage('analyzing');
      setProgress(50);

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          throw new Error(`Research quota exceeded: ${errorData.usage}/${errorData.limit} this month`);
        }
        
        if (response.status === 503) {
          throw new Error('Research service is not configured');
        }
        
        throw new Error(errorData.error || 'Research failed');
      }

      setStage('synthesizing');
      setProgress(75);

      const result = await response.json();

      // Step 3: If ZeroTrace is enabled, encrypt the results for storage
      if (isZeroTraceEnabled && conversationId) {
        setStage('decrypting');
        setProgress(90);
        
        // Store encrypted response back to database
        const encryptedResponse = await encryptMessage(conversationId, result.content);
        const encryptedCitations = await encryptMessage(conversationId, JSON.stringify(result.citations));
        
        // Update the research query with encrypted data
        await supabase
          .from('research_queries')
          .update({
            response_encrypted: encryptedResponse.ciphertext,
            response_nonce: encryptedResponse.nonce,
            citations_encrypted: encryptedCitations.ciphertext,
            citations_nonce: encryptedCitations.nonce
          })
          .eq('id', result.researchQueryId);
      }

      setStage('complete');
      setProgress(100);

      // Refresh quota after successful research
      await fetchQuota();

      return {
        ...result,
        isEncrypted: isZeroTraceEnabled
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Research failed';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsResearching(false);
      setStage('idle');
    }
  }, [isZeroTraceEnabled, isUnlocked, encryptMessage, fetchQuota]);

  // Load encrypted research result
  const loadEncryptedResult = useCallback(async (
    researchQueryId: string,
    conversationId: string
  ): Promise<{ content: string; citations: ResearchCitation[] } | null> => {
    if (!isUnlocked) {
      setError('Vault must be unlocked to view encrypted research');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('research_queries')
        .select('response_encrypted, response_nonce, citations_encrypted, citations_nonce, is_encrypted, citations_plaintext')
        .eq('id', researchQueryId)
        .single();

      if (error) throw error;

      if (!data.is_encrypted) {
        // Not encrypted, return plaintext citations
        return {
          content: '',
          citations: (data.citations_plaintext as unknown as ResearchCitation[]) || []
        };
      }

      // Decrypt
      const content = await decryptMessage(conversationId, {
        ciphertext: data.response_encrypted!,
        nonce: data.response_nonce!
      });

      const citationsJson = await decryptMessage(conversationId, {
        ciphertext: data.citations_encrypted!,
        nonce: data.citations_nonce!
      });

      return {
        content,
        citations: JSON.parse(citationsJson)
      };

    } catch (err) {
      console.error('Failed to load encrypted result:', err);
      return null;
    }
  }, [isUnlocked, decryptMessage]);

  return {
    research,
    loadEncryptedResult,
    fetchQuota,
    isResearching,
    stage,
    progress,
    error,
    quota,
    isZeroTrace: isZeroTraceEnabled
  };
}
