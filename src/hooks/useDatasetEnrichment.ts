import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnrichmentConfig {
  seedExamples: any[];
  targetCount: number;
  creativity: number; // 0.0 - 1.0
  instructions?: string;
  preserveFormat: boolean;
}

interface EnrichmentResult {
  generatedExamples: any[];
  totalGenerated: number;
  quality: 'high' | 'medium' | 'low';
}

export function useDatasetEnrichment() {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const { toast } = useToast();

  const enrichDataset = async (config: EnrichmentConfig): Promise<EnrichmentResult | null> => {
    setIsEnriching(true);
    setEnrichmentProgress(0);

    try {
      const batchSize = 10; // Generate 10 at a time
      const batches = Math.ceil(config.targetCount / batchSize);
      const allGenerated: any[] = [];

      for (let i = 0; i < batches; i++) {
        const remaining = config.targetCount - allGenerated.length;
        const currentBatchSize = Math.min(batchSize, remaining);

        // Select random seed examples for this batch
        const shuffled = [...config.seedExamples].sort(() => Math.random() - 0.5);
        const seedForBatch = shuffled.slice(0, Math.min(5, shuffled.length));

        const { data, error } = await supabase.functions.invoke('generate-synthetic', {
          body: {
            topic: 'Dataset enrichment based on seed examples',
            style: 'conversational',
            count: currentBatchSize,
            complexity: config.creativity > 0.5 ? 'advanced' : 'intermediate',
            seedExamples: seedForBatch,
            instructions: config.instructions || 'Generate variations of the provided examples while maintaining the same format and domain.',
            temperature: config.creativity
          }
        });

        if (error) throw error;

        if (data?.pairs) {
          allGenerated.push(...data.pairs);
        }

        setEnrichmentProgress(Math.round(((i + 1) / batches) * 100));
      }

      // Assess quality based on format consistency
      const formatConsistency = assessFormatConsistency(config.seedExamples, allGenerated);
      
      return {
        generatedExamples: allGenerated,
        totalGenerated: allGenerated.length,
        quality: formatConsistency > 0.8 ? 'high' : formatConsistency > 0.5 ? 'medium' : 'low'
      };

    } catch (error) {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to generate synthetic data",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsEnriching(false);
      setEnrichmentProgress(0);
    }
  };

  return {
    enrichDataset,
    isEnriching,
    enrichmentProgress
  };
}

function assessFormatConsistency(seeds: any[], generated: any[]): number {
  if (generated.length === 0) return 0;
  
  // Check if generated examples have the same keys as seeds
  const seedKeys = new Set(Object.keys(seeds[0] || {}));
  let matching = 0;
  
  for (const gen of generated) {
    const genKeys = new Set(Object.keys(gen));
    const overlap = [...seedKeys].filter(k => genKeys.has(k)).length;
    if (overlap >= seedKeys.size * 0.8) matching++;
  }
  
  return matching / generated.length;
}
