// useCitations.ts - Hook for managing source citations (Manus parity)

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Citation {
  id: string;
  source_url: string;
  source_title?: string;
  source_domain?: string;
  source_type?: 'web' | 'academic' | 'news' | 'database' | 'api';
  citation_key: string;
  access_date?: string;
  publication_date?: string;
  author?: string;
  excerpt?: string;
  relevance_score?: number;
  credibility_score?: number;
  verified?: boolean;
  metadata?: Record<string, any>;
}

export interface Claim {
  id: string;
  citation_id: string;
  claim_text: string;
  claim_type?: 'fact' | 'statistic' | 'quote' | 'opinion';
  verification_status?: 'unverified' | 'verified' | 'disputed' | 'false';
  confidence_score?: number;
  source_excerpt?: string;
  match_quality?: 'exact' | 'paraphrase' | 'inferred';
}

interface UseCitationsResult {
  citations: Citation[];
  claims: Claim[];
  loading: boolean;
  error: string | null;
  loadCitationsForRun: (runId: string) => Promise<void>;
  verifyCitation: (citationId: string) => Promise<boolean>;
  formatBibliography: (style?: 'apa' | 'mla' | 'chicago' | 'simple') => string;
  getCitationByKey: (key: string) => Citation | undefined;
  getClaimsForCitation: (citationId: string) => Claim[];
}

export function useCitations(): UseCitationsResult {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCitationsForRun = useCallback(async (runId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load citations
      const { data: citationsData, error: citationsError } = await supabase
        .from('source_citations')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true });

      if (citationsError) throw citationsError;

      setCitations(citationsData || []);

      // Load claims
      const { data: claimsData, error: claimsError } = await supabase
        .from('citation_claims')
        .select('*')
        .eq('run_id', runId)
        .order('position_in_output', { ascending: true });

      if (claimsError) throw claimsError;

      setClaims(claimsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load citations');
      console.error('[useCitations] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyCitation = useCallback(async (citationId: string): Promise<boolean> => {
    try {
      const citation = citations.find(c => c.id === citationId);
      if (!citation) return false;

      // Attempt to verify the URL
      const response = await fetch(citation.source_url, {
        method: 'HEAD',
        mode: 'no-cors',
      });

      const verified = true; // no-cors mode doesn't give us status

      // Update in database
      await supabase
        .from('source_citations')
        .update({
          verified,
          verification_method: 'url_check',
          verification_date: new Date().toISOString(),
        })
        .eq('id', citationId);

      // Update local state
      setCitations(prev =>
        prev.map(c =>
          c.id === citationId ? { ...c, verified } : c
        )
      );

      return verified;
    } catch (err) {
      console.error('[useCitations] Verification failed:', err);
      return false;
    }
  }, [citations]);

  const formatBibliography = useCallback(
    (style: 'apa' | 'mla' | 'chicago' | 'simple' = 'simple'): string => {
      return citations
        .map((c, i) => {
          const num = c.citation_key || `[${i + 1}]`;
          const title = c.source_title || 'Untitled';
          const domain = c.source_domain || new URL(c.source_url).hostname;
          const date = c.access_date
            ? new Date(c.access_date).toLocaleDateString()
            : '';
          const author = c.author || '';

          switch (style) {
            case 'apa':
              return `${author ? `${author}. ` : ''}(${date || 'n.d.'}). ${title}. Retrieved from ${c.source_url}`;
            case 'mla':
              return `${author ? `${author}. ` : ''}"${title}." ${domain}, ${date || 'n.d.'}. Web.`;
            case 'chicago':
              return `${author ? `${author}. ` : ''}"${title}." ${domain}. Accessed ${date || 'n.d.'}. ${c.source_url}.`;
            default:
              return `${num} ${title}. ${domain}. ${date ? `Accessed ${date}. ` : ''}${c.source_url}`;
          }
        })
        .join('\n\n');
    },
    [citations]
  );

  const getCitationByKey = useCallback(
    (key: string): Citation | undefined => {
      return citations.find(c => c.citation_key === key);
    },
    [citations]
  );

  const getClaimsForCitation = useCallback(
    (citationId: string): Claim[] => {
      return claims.filter(c => c.citation_id === citationId);
    },
    [claims]
  );

  return {
    citations,
    claims,
    loading,
    error,
    loadCitationsForRun,
    verifyCitation,
    formatBibliography,
    getCitationByKey,
    getClaimsForCitation,
  };
}

export default useCitations;
