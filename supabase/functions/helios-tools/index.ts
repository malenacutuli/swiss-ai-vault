/**
 * HELIOS Clinical Tools Edge Function
 * Provides access to clinical calculators
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool implementations (simplified for edge function)
const TOOLS = {
  heart_score: {
    name: 'HEART Score',
    description: 'HEART Score for chest pain risk stratification',
    calculate: (input: Record<string, unknown>) => {
      let score = 0;
      score += input.historyTypicality === 'highly_suspicious' ? 2 : input.historyTypicality === 'moderately_suspicious' ? 1 : 0;
      score += input.ecgFindings === 'significant_st_deviation' ? 2 : input.ecgFindings === 'nonspecific_changes' ? 1 : 0;
      score += (input.age as number) >= 65 ? 2 : (input.age as number) >= 45 ? 1 : 0;
      score += (input.riskFactorCount as number) >= 3 ? 2 : (input.riskFactorCount as number) >= 1 ? 1 : 0;
      score += input.troponin === 'elevated_3x' ? 2 : input.troponin === 'elevated_1_3x' ? 1 : 0;

      const category = score <= 3 ? 'low' : score <= 6 ? 'moderate' : 'high';
      const risk = score <= 3 ? 0.016 : score <= 6 ? 0.121 : 0.505;

      return { score, category, risk, interpretation: `HEART Score: ${score}/10 (${category} risk)` };
    },
  },

  qsofa: {
    name: 'qSOFA Score',
    description: 'Quick SOFA for sepsis screening',
    calculate: (input: Record<string, unknown>) => {
      let score = 0;
      if (input.alteredMentalStatus) score += 1;
      if ((input.respiratoryRate as number) >= 22) score += 1;
      if ((input.systolicBP as number) <= 100) score += 1;

      const positive = score >= 2;
      return {
        score,
        positive,
        interpretation: `qSOFA: ${score}/3 - ${positive ? 'POSITIVE' : 'Negative'}`,
      };
    },
  },

  curb65: {
    name: 'CURB-65 Score',
    description: 'CURB-65 for pneumonia severity',
    calculate: (input: Record<string, unknown>) => {
      let score = 0;
      if (input.confusion) score += 1;
      if ((input.bun as number) > 19) score += 1;
      if ((input.respiratoryRate as number) >= 30) score += 1;
      if ((input.systolicBP as number) < 90 || (input.diastolicBP as number) <= 60) score += 1;
      if ((input.age as number) >= 65) score += 1;

      const category = score <= 1 ? 'low' : score === 2 ? 'moderate' : 'severe';
      return { score, category, interpretation: `CURB-65: ${score}/5 (${category} severity)` };
    },
  },

  wells_dvt: {
    name: 'Wells Score for DVT',
    description: 'Pre-test probability for deep vein thrombosis',
    calculate: (input: Record<string, unknown>) => {
      let score = 0;
      if (input.activeCancer) score += 1;
      if (input.paralysisParesis) score += 1;
      if (input.bedridden3Days) score += 1;
      if (input.localizedTenderness) score += 1;
      if (input.entireLegSwollen) score += 1;
      if (input.calfSwelling3cm) score += 1;
      if (input.pittingEdema) score += 1;
      if (input.collateralVeins) score += 1;
      if (input.previousDVT) score += 1;
      if (input.alternativeDiagnosisLikely) score -= 2;

      const category = score <= 0 ? 'low' : score <= 2 ? 'moderate' : 'high';
      const risk = score <= 0 ? 0.05 : score <= 2 ? 0.17 : 0.53;

      return { score, category, risk, interpretation: `Wells DVT: ${score} (${category} probability)` };
    },
  },

  nihss: {
    name: 'NIH Stroke Scale',
    description: 'Quantifies stroke severity',
    calculate: (input: Record<string, unknown>) => {
      const score =
        ((input.consciousness as number) || 0) +
        ((input.monthYear as number) || 0) +
        ((input.commands as number) || 0) +
        ((input.gaze as number) || 0) +
        ((input.visualFields as number) || 0) +
        ((input.facialPalsy as number) || 0) +
        ((input.motorArmLeft as number) || 0) +
        ((input.motorArmRight as number) || 0) +
        ((input.motorLegLeft as number) || 0) +
        ((input.motorLegRight as number) || 0) +
        ((input.limbAtaxia as number) || 0) +
        ((input.sensory as number) || 0) +
        ((input.language as number) || 0) +
        ((input.dysarthria as number) || 0) +
        ((input.neglect as number) || 0);

      const category = score === 0 ? 'no_stroke' : score <= 4 ? 'minor' : score <= 15 ? 'moderate' : score <= 20 ? 'moderate_severe' : 'severe';

      return { score, category, interpretation: `NIHSS: ${score}/42 (${category})` };
    },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tool_id, input } = await req.json();

    switch (action) {
      case 'list': {
        const tools = Object.entries(TOOLS).map(([id, tool]) => ({
          id,
          name: tool.name,
          description: tool.description,
        }));
        return new Response(JSON.stringify({ tools }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'calculate': {
        const tool = TOOLS[tool_id as keyof typeof TOOLS];
        if (!tool) {
          throw new Error(`Tool not found: ${tool_id}`);
        }

        const result = tool.calculate(input);
        return new Response(JSON.stringify({ success: true, result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
