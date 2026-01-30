import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================
// EXPERT AGENT CONFIGURATIONS
// ============================================

// Minimal experts for fast response
const CORE_EXPERTS = [
  { id: 'internist', role: 'Board-Certified Internal Medicine & Emergency Physician', model: 'claude-haiku-4-5-20251001' },
];

// Symptom-based specialist selection
const SPECIALTY_MAPPING: Record<string, { id: string; role: string; model: string }> = {
  'chest|heart|palpitation|cardiac': { id: 'cardiologist', role: 'Board-Certified Cardiologist', model: 'claude-haiku-4-5-20251001' },
  'head|headache|neuro|dizzy|vision|seizure|stroke': { id: 'neurologist', role: 'Board-Certified Neurologist', model: 'claude-haiku-4-5-20251001' },
  'breath|cough|lung|asthma|respiratory': { id: 'pulmonologist', role: 'Board-Certified Pulmonologist', model: 'claude-haiku-4-5-20251001' },
  'stomach|nausea|abdom|bowel|digest': { id: 'gastroenterologist', role: 'Board-Certified Gastroenterologist', model: 'claude-haiku-4-5-20251001' },
  'skin|rash|itch|dermat': { id: 'dermatologist', role: 'Board-Certified Dermatologist', model: 'claude-haiku-4-5-20251001' },
  'joint|bone|muscle|back|arthritis': { id: 'rheumatologist', role: 'Board-Certified Rheumatologist', model: 'claude-haiku-4-5-20251001' },
  'anxiety|depress|mental|psych|stress': { id: 'psychiatrist', role: 'Board-Certified Psychiatrist', model: 'claude-haiku-4-5-20251001' },
  'child|pediatric|infant|baby': { id: 'pediatrician', role: 'Board-Certified Pediatrician', model: 'claude-haiku-4-5-20251001' },
  'pregnan|obstet|gynec|menstr': { id: 'obgyn', role: 'Board-Certified OB/GYN', model: 'claude-haiku-4-5-20251001' },
  'kidney|urinary|bladder': { id: 'nephrologist', role: 'Board-Certified Nephrologist', model: 'claude-haiku-4-5-20251001' },
  'diabetes|thyroid|hormone|endocrin': { id: 'endocrinologist', role: 'Board-Certified Endocrinologist', model: 'claude-haiku-4-5-20251001' },
  'allergy|immune|hives': { id: 'allergist', role: 'Board-Certified Allergist/Immunologist', model: 'claude-haiku-4-5-20251001' },
  'infection|fever|virus|bacteria': { id: 'infectious', role: 'Board-Certified Infectious Disease Specialist', model: 'claude-haiku-4-5-20251001' },
};

// ============================================
// TYPES
// ============================================

interface OrchestrationRequest {
  session_id: string;
  language?: string;
  chief_complaint: string;
  symptoms: string[];
  oldcarts_data: Record<string, unknown>;
  patient_demographics: {
    age?: number;
    sex?: string;
    medical_history?: string[];
    medications?: string[];
    allergies?: string[];
  };
  config?: {
    max_rounds?: number;
    consensus_threshold?: number;
    min_specialists?: number;
    max_specialists?: number;
  };
}

interface ExpertOpinion {
  expert_id: string;
  expert_role: string;
  differential_diagnosis: Array<{
    rank: number;
    diagnosis: string;
    confidence: number;
    reasoning: string;
    icd10_code?: string;
  }>;
  self_confidence: number;
  urgency_assessment: {
    esi_level: 1 | 2 | 3 | 4 | 5;
    reasoning: string;
    red_flags: string[];
  };
  recommendations: {
    diagnostic_tests: string[];
    imaging: string[];
    referrals: string[];
    medications?: string[];
  };
  uncertainty_areas?: string[];
  error?: string;
}

interface ConsensusResult {
  achieved: boolean;
  agreement_score: number;
  kendall_w: number;
  rounds_required: number;
  participating_agents: string[];
  primary_diagnosis: {
    diagnosis: string;
    icd10_code: string;
    icd10_name: string;
    confidence: number;
    reasoning: string;
    supporting_experts: string[];
  };
  differential_diagnoses: Array<{
    rank: number;
    diagnosis: string;
    icd10_code: string;
    icd10_name: string;
    confidence: number;
    reasoning: string;
  }>;
  dissenting_opinions?: Array<{
    agent_id: string;
    diagnosis: string;
    reasoning: string;
  }>;
}

// ============================================
// KENDALL'S W CALCULATION
// ============================================

function calculateKendallW(rankings: number[][]): number {
  if (!rankings.length || !rankings[0]?.length) return 0;

  const n = rankings.length; // number of raters (agents)
  const k = rankings[0].length; // number of items being ranked

  // Need at least 2 raters and 2 items
  if (n < 2 || k < 2) return 1.0;

  // Pad rankings to same length
  const maxLen = Math.max(...rankings.map(r => r.length));
  const paddedRankings = rankings.map(r => {
    const padded = [...r];
    while (padded.length < maxLen) padded.push(maxLen + 1);
    return padded;
  });

  // Calculate sum of ranks for each item
  const rankSums: number[] = Array(maxLen).fill(0);
  for (let j = 0; j < maxLen; j++) {
    for (let i = 0; i < n; i++) {
      rankSums[j] += paddedRankings[i][j];
    }
  }

  // Calculate mean rank sum
  const meanRankSum = rankSums.reduce((a, b) => a + b, 0) / maxLen;

  // Calculate sum of squared deviations
  const ss = rankSums.reduce((acc, r) => acc + Math.pow(r - meanRankSum, 2), 0);

  // Maximum possible SS (perfect agreement)
  const maxSS = (n * n * (maxLen * maxLen * maxLen - maxLen)) / 12;

  // Return W coefficient (0 = no agreement, 1 = perfect agreement)
  return maxSS === 0 ? 1.0 : Math.min(1.0, ss / maxSS);
}

// ============================================
// ICD-10 VALIDATION
// ============================================

async function validateICD10(diagnosis: string): Promise<{ code: string; name: string } | null> {
  try {
    const searchTerm = diagnosis
      .replace(/[^\w\s]/g, '')
      .trim()
      .toLowerCase();

    const response = await fetch(
      `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(searchTerm)}&maxList=5`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      if (data[0] > 0 && data[3]?.[0]) {
        return {
          code: data[3][0][0],
          name: data[3][0][1],
        };
      }
    }
  } catch (e) {
    console.error('[ORCHESTRATOR] ICD-10 validation error:', e);
  }
  return null;
}

// ============================================
// EXPERT AGENT RUNNER
// ============================================

async function runExpertAgent(
  expert: { id: string; role: string; model: string },
  caseSummary: string,
  anthropicKey: string,
  language: string = 'en'
): Promise<ExpertOpinion> {
  const systemPrompt = `You are ${expert.role} participating in a multi-disciplinary medical consultation (Grand Rounds).

Your task is to analyze the patient case and provide your expert opinion. Be thorough but concise.

CRITICAL RULES:
1. Base your assessment ONLY on the information provided
2. Identify any red flags requiring immediate attention
3. Use ESI (Emergency Severity Index) levels: 1=Immediate, 2=Emergent, 3=Urgent, 4=Less Urgent, 5=Non-urgent
4. Consider differential diagnoses in order of likelihood
5. Be appropriately conservative - when in doubt, err on the side of caution

OUTPUT FORMAT: Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "differential_diagnosis": [
    {"rank": 1, "diagnosis": "Most likely diagnosis", "confidence": 85, "reasoning": "Brief explanation"}
  ],
  "self_confidence": 0.8,
  "urgency_assessment": {
    "esi_level": 3,
    "reasoning": "Why this urgency level",
    "red_flags": ["Any concerning symptoms"]
  },
  "recommendations": {
    "diagnostic_tests": ["CBC", "BMP"],
    "imaging": ["X-ray chest"],
    "referrals": ["Specialist if needed"]
  },
  "uncertainty_areas": ["Areas needing more information"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: expert.model,
        max_tokens: 1000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Please analyze this patient case:\n\n${caseSummary}\n\nProvide your expert assessment as JSON.`
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ORCHESTRATOR] Expert ${expert.id} API error:`, response.status, errorText);
      return {
        expert_id: expert.id,
        expert_role: expert.role,
        error: `API error: ${response.status}`,
        differential_diagnosis: [],
        self_confidence: 0,
        urgency_assessment: { esi_level: 3, reasoning: 'Error', red_flags: [] },
        recommendations: { diagnostic_tests: [], imaging: [], referrals: [] },
      };
    }

    const data = await response.json();
    const text = data.content[0]?.text || '{}';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        expert_id: expert.id,
        expert_role: expert.role,
        ...parsed,
        differential_diagnosis: parsed.differential_diagnosis || [],
        self_confidence: parsed.self_confidence || 0.7,
        urgency_assessment: parsed.urgency_assessment || { esi_level: 3, reasoning: '', red_flags: [] },
        recommendations: parsed.recommendations || { diagnostic_tests: [], imaging: [], referrals: [] },
      };
    }

    throw new Error('No valid JSON in response');
  } catch (e) {
    console.error(`[ORCHESTRATOR] Expert ${expert.id} error:`, e);
    return {
      expert_id: expert.id,
      expert_role: expert.role,
      error: String(e),
      differential_diagnosis: [],
      self_confidence: 0,
      urgency_assessment: { esi_level: 3, reasoning: 'Error', red_flags: [] },
      recommendations: { diagnostic_tests: [], imaging: [], referrals: [] },
    };
  }
}

// ============================================
// CONSENSUS BUILDER
// ============================================

function buildConsensus(opinions: ExpertOpinion[]): {
  differential: Array<{
    rank: number;
    diagnosis: string;
    confidence: number;
    reasoning: string;
    supporting_experts: string[];
    icd10_code?: string;
    icd10_name?: string;
  }>;
  dissenting: Array<{ agent_id: string; diagnosis: string; reasoning: string }>;
} {
  const validOpinions = opinions.filter(o => !o.error && o.differential_diagnosis?.length > 0);

  if (validOpinions.length === 0) {
    return { differential: [], dissenting: [] };
  }

  // Aggregate diagnosis votes with weighted scoring
  const diagnosisVotes: Record<string, {
    weight: number;
    count: number;
    experts: string[];
    reasoning: string;
    confidences: number[];
  }> = {};

  for (const opinion of validOpinions) {
    const expertConfidence = opinion.self_confidence || 0.7;

    for (const dx of opinion.differential_diagnosis) {
      // Normalize diagnosis name for grouping
      const normalizedName = dx.diagnosis
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();

      if (!normalizedName) continue;

      if (!diagnosisVotes[normalizedName]) {
        diagnosisVotes[normalizedName] = {
          weight: 0,
          count: 0,
          experts: [],
          reasoning: dx.reasoning || '',
          confidences: [],
        };
      }

      // Weight by rank position (1st = 1.0, 2nd = 0.5, 3rd = 0.33, etc.)
      const rankWeight = 1 / (dx.rank || 1);
      // Weight by stated confidence
      const confWeight = (dx.confidence || 50) / 100;
      // Weight by expert self-confidence
      const totalWeight = rankWeight * confWeight * expertConfidence;

      diagnosisVotes[normalizedName].weight += totalWeight;
      diagnosisVotes[normalizedName].count++;
      diagnosisVotes[normalizedName].experts.push(opinion.expert_id);
      diagnosisVotes[normalizedName].confidences.push(dx.confidence || 50);

      // Keep best reasoning
      if (dx.reasoning && dx.reasoning.length > diagnosisVotes[normalizedName].reasoning.length) {
        diagnosisVotes[normalizedName].reasoning = dx.reasoning;
      }
    }
  }

  // Sort by weight and take top 5
  const sorted = Object.entries(diagnosisVotes)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 5);

  const differential = sorted.map(([name, data], i) => {
    // Calculate consensus confidence
    const avgConfidence = data.confidences.length > 0
      ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
      : 50;
    const agreementBonus = (data.count / validOpinions.length) * 20;
    const finalConfidence = Math.min(95, Math.round(avgConfidence + agreementBonus));

    return {
      rank: i + 1,
      diagnosis: name.charAt(0).toUpperCase() + name.slice(1),
      confidence: finalConfidence,
      reasoning: data.reasoning,
      supporting_experts: [...new Set(data.experts)],
    };
  });

  // Identify dissenting opinions (unique diagnoses not in top consensus)
  const topDiagnoses = new Set(sorted.map(([name]) => name));
  const dissenting: Array<{ agent_id: string; diagnosis: string; reasoning: string }> = [];

  for (const opinion of validOpinions) {
    const topDx = opinion.differential_diagnosis[0];
    if (topDx) {
      const normalizedName = topDx.diagnosis.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (!topDiagnoses.has(normalizedName) && topDx.confidence >= 60) {
        dissenting.push({
          agent_id: opinion.expert_id,
          diagnosis: topDx.diagnosis,
          reasoning: topDx.reasoning || '',
        });
      }
    }
  }

  return { differential, dissenting };
}

// ============================================
// SELECT RELEVANT EXPERTS
// ============================================

function selectExperts(
  symptoms: string[],
  chiefComplaint: string,
  config?: { min_specialists?: number; max_specialists?: number }
): Array<{ id: string; role: string; model: string }> {
  const experts = [...CORE_EXPERTS];
  const searchText = [...symptoms, chiefComplaint].join(' ').toLowerCase();

  const addedSpecialists = new Set<string>();

  for (const [pattern, specialist] of Object.entries(SPECIALTY_MAPPING)) {
    if (new RegExp(pattern, 'i').test(searchText) && !addedSpecialists.has(specialist.id)) {
      experts.push(specialist);
      addedSpecialists.add(specialist.id);

      // Limit to 1 specialist to reduce latency (total 4 experts max)
      const maxSpecialists = config?.max_specialists || 4;
      if (addedSpecialists.size >= maxSpecialists - CORE_EXPERTS.length) {
        break;
      }
    }
  }

  // Limit to max 3 experts for faster response
  return experts.slice(0, 3);
}

// ============================================
// BUILD CASE SUMMARY
// ============================================

function buildCaseSummary(request: OrchestrationRequest): string {
  const oldcarts = request.oldcarts_data || {};

  return `
═══════════════════════════════════════════════════════════
PATIENT CASE FOR MULTI-DISCIPLINARY CONSULTATION
═══════════════════════════════════════════════════════════

CHIEF COMPLAINT
───────────────
${request.chief_complaint || 'Not specified'}

ASSOCIATED SYMPTOMS
───────────────────
${request.symptoms?.length > 0 ? request.symptoms.map(s => `• ${s}`).join('\n') : 'None reported'}

OLDCARTS ASSESSMENT
───────────────────
• Onset: ${oldcarts.onset || 'Unknown'}
• Location: ${oldcarts.location || 'Unknown'}
• Duration: ${oldcarts.duration || 'Unknown'}
• Character: ${oldcarts.character || 'Unknown'}
• Aggravating factors: ${oldcarts.aggravating || 'Unknown'}
• Relieving factors: ${oldcarts.relieving || 'Unknown'}
• Timing: ${oldcarts.timing || 'Unknown'}
• Severity: ${oldcarts.severity || 'Unknown'}/10

PATIENT DEMOGRAPHICS
────────────────────
• Age: ${request.patient_demographics?.age || 'Unknown'}
• Sex: ${request.patient_demographics?.sex || 'Unknown'}
• Medical History: ${request.patient_demographics?.medical_history?.join(', ') || 'None reported'}
• Current Medications: ${request.patient_demographics?.medications?.join(', ') || 'None reported'}
• Allergies: ${request.patient_demographics?.allergies?.join(', ') || 'NKDA'}

═══════════════════════════════════════════════════════════
`.trim();
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    }

    // Parse request
    const request: OrchestrationRequest = await req.json();

    if (!request.session_id) {
      throw new Error('session_id is required');
    }

    console.log(`[ORCHESTRATOR] Starting consultation for session ${request.session_id}`);

    // Build case summary
    const caseSummary = buildCaseSummary(request);

    // Select relevant experts based on symptoms
    const experts = selectExperts(
      request.symptoms || [],
      request.chief_complaint || '',
      request.config
    );

    console.log(`[ORCHESTRATOR] Consulting ${experts.length} experts: ${experts.map(e => e.id).join(', ')}`);

    // Run all expert analyses in parallel
    const opinions = await Promise.all(
      experts.map(expert => runExpertAgent(expert, caseSummary, anthropicKey, request.language || 'en'))
    );

    const validOpinions = opinions.filter(o => !o.error);
    console.log(`[ORCHESTRATOR] Received ${validOpinions.length}/${opinions.length} valid opinions`);

    // Build consensus from opinions
    const { differential, dissenting } = buildConsensus(validOpinions);

    // Calculate Kendall's W for agreement measure
    const rankings = validOpinions
      .map(o => o.differential_diagnosis?.map(d => d.rank) || [])
      .filter(r => r.length > 0);
    const kendallW = calculateKendallW(rankings);

    // Aggregate urgency assessments (take most urgent)
    const esiLevels = validOpinions
      .map(o => o.urgency_assessment?.esi_level)
      .filter((level): level is 1 | 2 | 3 | 4 | 5 => typeof level === 'number');
    const finalEsi = esiLevels.length > 0 ? Math.min(...esiLevels) as 1 | 2 | 3 | 4 | 5 : 3;

    // Collect all red flags
    const allRedFlags = validOpinions.flatMap(o => o.urgency_assessment?.red_flags || []);
    const uniqueRedFlags = [...new Set(allRedFlags)];

    // Aggregate recommendations
    const allTests = validOpinions.flatMap(o => o.recommendations?.diagnostic_tests || []);
    const allImaging = validOpinions.flatMap(o => o.recommendations?.imaging || []);
    const allReferrals = validOpinions.flatMap(o => o.recommendations?.referrals || []);

    // Skip ICD-10 validation for faster response
    const fullDifferential = differential.map(dx => ({
      ...dx,
      icd10_code: '',
      icd10_name: dx.diagnosis,
    }));

    // Determine disposition based on ESI
    const dispositionMap: Record<number, string> = {
      1: 'emergency',
      2: 'emergency',
      3: 'urgent_care',
      4: 'primary_care',
      5: 'self_care',
    };

    // Build final response
    const result = {
      session_id: request.session_id,
      consensus: {
        achieved: kendallW >= 0.7 && validOpinions.length >= 3,
        agreement_score: Math.round(kendallW * 1000) / 1000,
        kendall_w: Math.round(kendallW * 1000) / 1000,
        rounds_required: 1,
        consensus_reached: kendallW >= 0.7,
        participating_agents: validOpinions.map(o => o.expert_id),
        primary_diagnosis: fullDifferential[0] || {
          rank: 1,
          diagnosis: 'Unable to determine',
          icd10_code: '',
          icd10_name: 'Unable to determine',
          confidence: 0,
          reasoning: 'Insufficient information or expert agreement',
          supporting_experts: [],
        },
        differential_diagnoses: fullDifferential,
        dissenting_opinions: dissenting,
      },
      triage: {
        esi_level: finalEsi,
        disposition: dispositionMap[finalEsi] || 'primary_care',
        urgency: ['immediate', 'emergent', 'urgent', 'less_urgent', 'non_urgent'][finalEsi - 1],
        reasoning: validOpinions.find(o => o.urgency_assessment?.esi_level === finalEsi)?.urgency_assessment?.reasoning || '',
        human_review_required: finalEsi <= 2 || kendallW < 0.7 || uniqueRedFlags.length > 0,
      },
      plan: {
        immediate_actions: finalEsi <= 2
          ? ['Seek immediate medical attention', 'Call emergency services if symptoms worsen']
          : ['Schedule appointment with healthcare provider'],
        lab_tests: [...new Set(allTests)].slice(0, 6),
        imaging: [...new Set(allImaging)].slice(0, 4),
        referrals: [...new Set(allReferrals)].slice(0, 4),
        medications: [],
        patient_education: [
          'Keep track of your symptoms',
          'Note any changes or new symptoms',
          'Follow up with your healthcare provider as recommended',
        ],
        follow_up: finalEsi <= 2 ? 'Within 24 hours' : finalEsi === 3 ? 'Within 48-72 hours' : 'As recommended by provider',
        red_flag_warnings: uniqueRedFlags,
      },
      safety: {
        critical_finding: finalEsi <= 2,
        human_review_required: finalEsi <= 2 || kendallW < 0.7 || uniqueRedFlags.length > 0,
        red_flags_identified: uniqueRedFlags,
        confidence_level: kendallW >= 0.8 ? 'high' : kendallW >= 0.6 ? 'moderate' : 'low',
      },
      soap_note: {
        subjective: `Chief complaint: ${request.chief_complaint}. ${request.symptoms?.join('. ') || ''}`,
        objective: `OLDCARTS assessment completed. Severity: ${request.oldcarts_data?.severity || 'Not reported'}/10.`,
        assessment: `Primary: ${fullDifferential[0]?.diagnosis || 'Undetermined'}. ESI Level: ${finalEsi}. ${fullDifferential.length > 1 ? `Differential: ${fullDifferential.slice(1, 4).map(d => d.diagnosis).join(', ')}.` : ''}`,
        plan: `${[...new Set(allTests)].slice(0, 3).join(', ') || 'No labs'}. ${[...new Set(allImaging)].slice(0, 2).join(', ') || 'No imaging'}. Follow-up: ${finalEsi <= 2 ? '24 hours' : 'As needed'}.`,
      },
      processing_time_ms: Date.now() - startTime,
      experts_consulted: validOpinions.length,
    };

    console.log(`[ORCHESTRATOR] Completed in ${result.processing_time_ms}ms. Kendall W: ${kendallW.toFixed(3)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ORCHESTRATOR] Error:', error);

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      session_id: null,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
