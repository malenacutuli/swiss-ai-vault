// ===========================================
// AUDIO BRIEFING EDGE FUNCTION
// Multilingual support with custom context
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DURATION_WORDS = {
  short: 500,    // ~3-5 min
  medium: 1000,  // ~7-10 min  
  long: 2000,    // ~15-20 min
};

const FORMAT_PROMPTS: Record<string, Record<string, string>> = {
  en: {
    deep_dive: "Create a comprehensive, detailed discussion exploring all aspects of these documents.",
    quick_brief: "Create a concise executive summary hitting only the most critical points.",
    debate: "Create a balanced debate with Alex taking one perspective and Jordan taking another.",
    critique: "Create a critical analysis examining strengths, weaknesses, and potential issues.",
    tutorial: "Create an educational walkthrough explaining concepts step by step.",
  },
  es: {
    deep_dive: "Crea una discusión completa y detallada explorando todos los aspectos de estos documentos.",
    quick_brief: "Crea un resumen ejecutivo conciso enfocándote solo en los puntos más críticos.",
    debate: "Crea un debate equilibrado donde Alex tome una perspectiva y Jordan otra.",
    critique: "Crea un análisis crítico examinando fortalezas, debilidades y posibles problemas.",
    tutorial: "Crea una explicación educativa paso a paso de los conceptos.",
  },
  fr: {
    deep_dive: "Créez une discussion complète et détaillée explorant tous les aspects de ces documents.",
    quick_brief: "Créez un résumé exécutif concis ne touchant que les points les plus critiques.",
    debate: "Créez un débat équilibré où Alex prend une perspective et Jordan une autre.",
    critique: "Créez une analyse critique examinant les forces, faiblesses et problèmes potentiels.",
    tutorial: "Créez une présentation éducative expliquant les concepts étape par étape.",
  },
  de: {
    deep_dive: "Erstellen Sie eine umfassende, detaillierte Diskussion, die alle Aspekte dieser Dokumente untersucht.",
    quick_brief: "Erstellen Sie eine prägnante Zusammenfassung mit nur den wichtigsten Punkten.",
    debate: "Erstellen Sie eine ausgewogene Debatte, bei der Alex eine Perspektive und Jordan eine andere vertritt.",
    critique: "Erstellen Sie eine kritische Analyse, die Stärken, Schwächen und mögliche Probleme untersucht.",
    tutorial: "Erstellen Sie eine Schritt-für-Schritt-Erklärung der Konzepte.",
  },
  it: {
    deep_dive: "Crea una discussione completa e dettagliata esplorando tutti gli aspetti di questi documenti.",
    quick_brief: "Crea un riassunto esecutivo conciso toccando solo i punti più critici.",
    debate: "Crea un dibattito equilibrato dove Alex prende una prospettiva e Jordan un'altra.",
    critique: "Crea un'analisi critica esaminando punti di forza, debolezze e potenziali problemi.",
    tutorial: "Crea una spiegazione educativa passo dopo passo dei concetti.",
  },
  pt: {
    deep_dive: "Crie uma discussão abrangente e detalhada explorando todos os aspectos destes documentos.",
    quick_brief: "Crie um resumo executivo conciso focando apenas nos pontos mais críticos.",
    debate: "Crie um debate equilibrado onde Alex tem uma perspectiva e Jordan outra.",
    critique: "Crie uma análise crítica examinando forças, fraquezas e potenciais problemas.",
    tutorial: "Crie uma explicação educacional passo a passo dos conceitos.",
  },
};

// Language names for prompts
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
};

// OpenAI TTS voice mapping for different languages
const VOICE_MAPPING: Record<string, { alex: string; jordan: string }> = {
  en: { alex: 'alloy', jordan: 'nova' },
  es: { alex: 'onyx', jordan: 'nova' },
  fr: { alex: 'onyx', jordan: 'nova' },
  de: { alex: 'echo', jordan: 'nova' },
  it: { alex: 'onyx', jordan: 'nova' },
  pt: { alex: 'onyx', jordan: 'nova' },
  nl: { alex: 'echo', jordan: 'nova' },
  ja: { alex: 'echo', jordan: 'shimmer' },
  zh: { alex: 'echo', jordan: 'shimmer' },
  ko: { alex: 'echo', jordan: 'shimmer' },
  ar: { alex: 'onyx', jordan: 'nova' },
  ru: { alex: 'onyx', jordan: 'nova' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for storage
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization');
    let userId = 'anonymous';
    let isAnonymous = true;
    
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (!authError && user) {
        userId = user.id;
        isAnonymous = false;
      }
    }

    // Anonymous audio limit check
    if (isAnonymous) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
      const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const { data: check } = await supabase.rpc('check_anonymous_usage', {
        p_ip_hash: ipHash,
        p_usage_type: 'audio'
      });
      
      if (!check?.allowed) {
        return new Response(JSON.stringify({
          error: 'Free audio limit reached. Create an account for more.',
          limit_reached: true,
          used: check?.used || 1,
          limit: check?.limit || 1
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { 
      documents, 
      format = 'deep_dive', 
      duration = 'medium', 
      language = 'en',
      customContext,
      title 
    } = await req.json();

    if (!documents || documents.length === 0) {
      throw new Error('At least one document is required');
    }

    // Generate unique briefing ID
    const briefingId = crypto.randomUUID();
    console.log(`[audio-briefing] Starting briefing ${briefingId} for user ${userId} in ${language}`);

    // Aggregate document content
    const documentContent = documents.map((doc: any, i: number) => 
      `=== Document ${i + 1}: ${doc.title} ===\n${doc.content}`
    ).join('\n\n');

    const targetWords = DURATION_WORDS[duration as keyof typeof DURATION_WORDS] || 1000;
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const formatPrompt = FORMAT_PROMPTS[language]?.[format] || FORMAT_PROMPTS.en[format] || FORMAT_PROMPTS.en.deep_dive;
    const voices = VOICE_MAPPING[language] || VOICE_MAPPING.en;

    // Build custom context instruction
    const customContextInstruction = customContext 
      ? `\n\nIMPORTANT USER CONTEXT - The user has specifically requested to focus on the following perspectives and information:\n"""${customContext}"""\nMake sure to address these points prominently in the discussion.`
      : '';

    // =====================================================
    // STEP 1: Generate outline using Gemini
    // =====================================================
    console.log('[audio-briefing] Generating outline...');
    
    const outlineResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Analyze these documents and create an outline for an audio briefing in ${languageName}.
${customContextInstruction}

Documents:
${documentContent}

Return a JSON object with all text in ${languageName}:
{
  "title": "Briefing title in ${languageName}",
  "keyThemes": ["theme1", "theme2", ...],
  "keyFacts": ["fact1", "fact2", ...],
  "questions": ["question to explore 1", ...],
  "risks": ["potential risk/concern 1", ...],
  "opportunities": ["opportunity 1", ...]
}

Only return valid JSON, no markdown.`
            }]
          }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    );

    if (!outlineResponse.ok) {
      const errorText = await outlineResponse.text();
      console.error('[audio-briefing] Outline error:', errorText);
      throw new Error('Failed to generate outline');
    }
    
    const outlineData = await outlineResponse.json();
    const outlineText = outlineData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let outline;
    try {
      outline = JSON.parse(outlineText.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
      console.error('[audio-briefing] Failed to parse outline:', outlineText);
      outline = { title: title || 'Audio Briefing', keyThemes: [], keyFacts: [] };
    }

    // =====================================================
    // STEP 2: Generate dialogue script using Gemini
    // =====================================================
    console.log('[audio-briefing] Generating dialogue script...');

    const dialogueResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Create a podcast dialogue script between two hosts: Alex and Jordan.
The entire script MUST be in ${languageName}.

Topic: ${outline.title}
Key themes: ${outline.keyThemes?.join(', ')}
Key facts: ${outline.keyFacts?.join(', ')}
Questions to explore: ${outline.questions?.join(', ')}
${customContextInstruction}

Format instruction: ${formatPrompt}

Target length: approximately ${targetWords} words total.

Return a JSON array of dialogue parts (all in ${languageName}):
[
  {"speaker": "Alex", "text": "${language === 'es' ? 'Bienvenidos a nuestro briefing...' : language === 'fr' ? 'Bienvenue à notre briefing...' : 'Welcome to our briefing...'}"},
  {"speaker": "Jordan", "text": "..."},
  ...
]

Make it conversational, engaging, and informative. Alex is more analytical, Jordan is more curious and asks follow-up questions.
ALL dialogue must be in ${languageName}.

Only return valid JSON array, no markdown.`
            }]
          }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!dialogueResponse.ok) {
      const errorText = await dialogueResponse.text();
      console.error('[audio-briefing] Dialogue error:', errorText);
      throw new Error('Failed to generate dialogue');
    }

    const dialogueData = await dialogueResponse.json();
    const dialogueText = dialogueData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    let dialogue: Array<{speaker: string, text: string}>;
    try {
      dialogue = JSON.parse(dialogueText.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
      console.error('[audio-briefing] Failed to parse dialogue:', dialogueText);
      throw new Error('Failed to parse dialogue script');
    }

    console.log(`[audio-briefing] Dialogue has ${dialogue.length} parts in ${languageName}`);

    // =====================================================
    // STEP 3: Generate audio and upload incrementally
    // =====================================================
    console.log('[audio-briefing] Generating and uploading audio...');
    
    const audioChunks: Uint8Array[] = [];
    let totalSize = 0;
    
    // Limit dialogue parts for memory safety
    const maxParts = duration === 'short' ? 8 : duration === 'medium' ? 12 : 16;
    const limitedDialogue = dialogue.slice(0, maxParts);
    
    for (let i = 0; i < limitedDialogue.length; i++) {
      const part = limitedDialogue[i];
      const voice = part.speaker === 'Alex' ? voices.alex : voices.jordan;
      
      console.log(`[audio-briefing] TTS ${i + 1}/${limitedDialogue.length}: ${part.speaker} (${voice})`);
      
      const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: part.text.substring(0, 4096),
          voice,
          response_format: 'mp3',
        }),
      });

      if (!ttsResponse.ok) {
        console.error(`[audio-briefing] TTS failed for part ${i + 1}: ${ttsResponse.status}`);
        continue;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      const chunk = new Uint8Array(audioBuffer);
      audioChunks.push(chunk);
      totalSize += chunk.length;
      
      console.log(`[audio-briefing] Part ${i + 1} size: ${chunk.length} bytes (total: ${totalSize})`);
    }

    // =====================================================
    // STEP 4: Combine and upload to Storage
    // =====================================================
    console.log(`[audio-briefing] Combining ${audioChunks.length} chunks (${totalSize} bytes)...`);
    
    // Combine chunks
    const combinedAudio = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Clear chunks array to free memory before upload
    audioChunks.length = 0;
    
    // Upload to Supabase Storage
    const filePath = `${userId}/${briefingId}.mp3`;
    console.log(`[audio-briefing] Uploading to storage: ${filePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from('audio-briefings')
      .upload(filePath, combinedAudio, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[audio-briefing] Upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // =====================================================
    // STEP 5: Generate signed URL (valid for 24 hours)
    // =====================================================
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audio-briefings')
      .createSignedUrl(filePath, 86400); // 24 hours

    if (signedUrlError) {
      console.error('[audio-briefing] Signed URL error:', signedUrlError);
      throw new Error('Failed to generate signed URL');
    }

    console.log(`[audio-briefing] Complete! Audio uploaded in ${languageName}`);

    // =====================================================
    // STEP 6: Return response with URL
    // =====================================================
    return new Response(JSON.stringify({
      id: briefingId,
      title: title || outline.title || 'Audio Briefing',
      format,
      duration,
      language,
      audioUrl: signedUrlData.signedUrl,
      audioSize: totalSize,
      storagePath: filePath,
      transcript: limitedDialogue,
      outline,
      customContext: customContext || null,
      status: 'ready',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[audio-briefing] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: 'error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
