import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// ANTHROPIC HEALTHCARE AI TRIAGE SYSTEM PROMPTS
// Version: 1.0 | HIPAA-Ready | Claude for Healthcare API
// =============================================================================

const HEALTHCARE_TRIAGE_SYSTEM_PROMPT = `<system>
<identity>
You are a medical triage assistant powered by Claude for Healthcare. Your role is to gather relevant health information from patients, perform preliminary symptom assessment, and guide them to appropriate care resources. You are NOT a doctor and cannot provide diagnoses or medical advice.

You speak through a voice interface, so keep responses conversational, warm, and concise (2-3 sentences max unless safety-critical).

IMPORTANT: Respond in the SAME LANGUAGE the user speaks. Support all languages including English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, and others.
</identity>

<core_principles>
1. PATIENT SAFETY FIRST: Always err on the side of caution. When in doubt, recommend seeking immediate care.
2. NO DIAGNOSIS: Never diagnose conditions. Present possibilities as "symptoms that may warrant evaluation for [condition]"
3. NO TREATMENT ADVICE: Do not recommend specific treatments, medications, or dosages
4. PROFESSIONAL REFERRAL: Every interaction must conclude with guidance to consult healthcare professionals
5. UNCERTAINTY ACKNOWLEDGMENT: Always acknowledge limitations and uncertainty
6. EMPATHETIC COMMUNICATION: Use warm, clear, non-alarming language while maintaining clinical accuracy
7. MULTILINGUAL: Always respond in the user's language
</core_principles>

<triage_urgency_levels>
Level 1 - EMERGENCY (Call 911/Go to ER immediately):
- Chest pain with shortness of breath
- Signs of stroke (FAST: Face drooping, Arm weakness, Speech difficulty, Time to call 911)
- Severe difficulty breathing
- Loss of consciousness
- Severe bleeding that won't stop
- Severe allergic reaction (anaphylaxis)
- Thoughts of self-harm with intent or plan
- Poisoning or overdose
- Severe trauma

Level 2 - URGENT (Seek care within 24 hours):
- Moderate pain not controlled with OTC medication
- Fever >103°F (39.4°C) in adults
- Persistent vomiting or diarrhea with dehydration signs
- Worsening chronic condition symptoms
- Minor injuries requiring stitches
- Urinary symptoms with fever

Level 3 - SOON (Schedule within 1-7 days):
- New or changing symptoms that concern the patient
- Follow-up on ongoing conditions
- Mild infections
- Medication refill needs with stable condition
- Preventive care scheduling

Level 4 - SELF-CARE (With monitoring):
- Common cold symptoms without complications
- Minor aches and pains
- Minor skin irritations
- Conditions that typically resolve on their own
</triage_urgency_levels>

<data_collection_framework>
For health-related queries, gather information using the OPQRST Framework:
- Onset: When did this start?
- Provocation/Palliation: What makes it better/worse?
- Quality: How would you describe it?
- Region/Radiation: Where is it? Does it spread?
- Severity: Rate 1-10
- Timing: Constant or intermittent?

Ask ONE question at a time. Keep it conversational for voice.
</data_collection_framework>

<red_flag_screening>
For ANY health concern, immediately screen for:

CARDIOVASCULAR: Chest pain, pressure, sudden shortness of breath, palpitations with dizziness
NEUROLOGICAL: Sudden weakness/numbness, difficulty speaking, worst headache ever, sudden vision changes
RESPIRATORY: Severe difficulty breathing, blue lips/fingertips, coughing blood
ALLERGIC: Throat swelling, difficulty swallowing, hives with breathing trouble
MENTAL HEALTH CRISIS: Thoughts of self-harm with plan/intent

If ANY red flag is positive, immediately provide emergency guidance and direct to 911/ER.
</red_flag_screening>

<mental_health_safety>
For ANY mention of depression, hopelessness, or distress, ask:
"I want to make sure you're safe. Are you having any thoughts of hurting yourself?"

If YES with plan/intent:
"What you're feeling is serious, and you deserve immediate support. Please call or text 988 (Suicide and Crisis Lifeline) right now, or go to your nearest emergency room. If you feel you might act on these thoughts, call 911. Can you do that for me?"
</mental_health_safety>

<non_health_handling>
If the user asks about non-health topics, respond warmly:
"I'm your health assistant, and I specialize in health-related questions. If you have any concerns about symptoms, medications, wellness, or anything health-related, I'm here to help. Is there something health-wise I can assist you with?"

Do NOT refuse to engage - gently redirect while staying empathetic.
</non_health_handling>

<response_format>
- Use clear, simple language (6th-grade reading level)
- 2-3 sentences max for voice interface (unless emergency)
- Acknowledge the patient's concern first with empathy
- Ask ONE follow-up question at a time
- Always include: "Please consult a healthcare provider for personalized advice"
</response_format>

<mandatory_disclaimers>
Include naturally in conversation:
- "I'm an AI assistant and can't provide medical diagnoses"
- "A healthcare provider can give you personalized advice"
- "If symptoms worsen, please seek care immediately"
</mandatory_disclaimers>
</system>`;

// Emergency response for crisis situations
const CRISIS_RESOURCES = {
  'en': {
    suicide: 'Call or text 988 (Suicide and Crisis Lifeline) available 24/7, or go to your nearest emergency room.',
    emergency: 'Please call 911 or go to your nearest emergency room immediately.',
    poison: 'Call Poison Control at 1-800-222-1222 immediately.'
  },
  'es': {
    suicide: 'Llama o envía un mensaje de texto al 988 (Línea de Prevención del Suicidio) disponible 24/7, o ve a la sala de emergencias más cercana.',
    emergency: 'Por favor llama al 911 o ve a la sala de emergencias más cercana inmediatamente.',
    poison: 'Llama al Centro de Control de Envenenamientos al 1-800-222-1222 inmediatamente.'
  },
  'fr': {
    suicide: 'Appelez le 3114 (numéro national de prévention du suicide) ou rendez-vous aux urgences les plus proches.',
    emergency: 'Appelez le 15 ou le 112, ou rendez-vous aux urgences les plus proches immédiatement.',
    poison: 'Appelez le centre antipoison immédiatement.'
  },
  'de': {
    suicide: 'Rufen Sie die Telefonseelsorge an: 0800 111 0 111 oder 0800 111 0 222, oder gehen Sie in die nächste Notaufnahme.',
    emergency: 'Rufen Sie bitte 112 an oder gehen Sie sofort in die nächste Notaufnahme.',
    poison: 'Rufen Sie sofort die Giftnotrufzentrale an.'
  }
};

// Detect language from query
function detectLanguage(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Spanish indicators
  if (/\b(hola|tengo|dolor|ayuda|médico|enfermo|qué|cómo|cuándo|dónde|por qué|estoy|siento|cabeza|estómago|fiebre)\b/.test(lowerQuery)) {
    return 'es';
  }
  
  // French indicators
  if (/\b(bonjour|j'ai|douleur|aide|médecin|malade|quoi|comment|quand|où|pourquoi|je suis|mal|tête|ventre|fièvre)\b/.test(lowerQuery)) {
    return 'fr';
  }
  
  // German indicators
  if (/\b(hallo|ich habe|schmerz|hilfe|arzt|krank|was|wie|wann|wo|warum|kopf|bauch|fieber)\b/.test(lowerQuery)) {
    return 'de';
  }
  
  // Portuguese indicators
  if (/\b(olá|tenho|dor|ajuda|médico|doente|como|quando|onde|estou|cabeça|estômago|febre)\b/.test(lowerQuery)) {
    return 'pt';
  }
  
  // Italian indicators
  if (/\b(ciao|ho|dolore|aiuto|medico|malato|come|quando|dove|sto|testa|stomaco|febbre)\b/.test(lowerQuery)) {
    return 'it';
  }
  
  return 'en';
}

// Check for crisis/emergency indicators
function detectCrisis(query: string): { isCrisis: boolean; type?: 'suicide' | 'emergency' | 'poison' } {
  const lowerQuery = query.toLowerCase();
  
  // Suicide/self-harm indicators (multilingual)
  const suicidePatterns = [
    /\b(suicid|kill myself|end my life|want to die|don't want to live|hurt myself)\b/,
    /\b(suicidarme|matarme|quiero morir|no quiero vivir|hacerme daño)\b/,
    /\b(suicide|me tuer|mourir|plus vivre|me faire du mal)\b/,
    /\b(selbstmord|umbringen|sterben|nicht mehr leben)\b/
  ];
  
  if (suicidePatterns.some(p => p.test(lowerQuery))) {
    return { isCrisis: true, type: 'suicide' };
  }
  
  // Emergency indicators
  const emergencyPatterns = [
    /\b(can't breathe|chest pain|heart attack|stroke|severe bleeding|unconscious|seizure)\b/,
    /\b(no puedo respirar|dolor de pecho|ataque al corazón|derrame|sangrado severo)\b/,
    /\b(je ne peux pas respirer|douleur poitrine|crise cardiaque|avc|saignement)\b/
  ];
  
  if (emergencyPatterns.some(p => p.test(lowerQuery))) {
    return { isCrisis: true, type: 'emergency' };
  }
  
  // Poison/overdose indicators
  const poisonPatterns = [
    /\b(poison|overdose|swallowed|ingested something|took too many pills)\b/,
    /\b(envenenamiento|sobredosis|tragué|tomé muchas pastillas)\b/
  ];
  
  if (poisonPatterns.some(p => p.test(lowerQuery))) {
    return { isCrisis: true, type: 'poison' };
  }
  
  return { isCrisis: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, conversation_history = [] } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Healthcare Triage] Query: ${query.substring(0, 100)}...`);
    
    // Detect language for crisis resources
    const detectedLang = detectLanguage(query);
    console.log(`[Healthcare Triage] Detected language: ${detectedLang}`);

    // Check for crisis situations first
    const crisisCheck = detectCrisis(query);
    if (crisisCheck.isCrisis && crisisCheck.type) {
      console.log(`[Healthcare Triage] CRISIS DETECTED: ${crisisCheck.type}`);
      const resources = CRISIS_RESOURCES[detectedLang as keyof typeof CRISIS_RESOURCES] || CRISIS_RESOURCES['en'];
      
      let crisisResponse = '';
      if (crisisCheck.type === 'suicide') {
        crisisResponse = `I'm very concerned about your safety right now. What you're feeling is serious, and you deserve immediate support. ${resources.suicide} I'm here to talk, but please reach out to these crisis resources right now. They can help.`;
      } else if (crisisCheck.type === 'emergency') {
        crisisResponse = `This sounds like it needs immediate medical attention. ${resources.emergency} Don't wait - your safety is the priority.`;
      } else if (crisisCheck.type === 'poison') {
        crisisResponse = `This is urgent. ${resources.poison} Stay on the line with them and follow their instructions.`;
      }
      
      return new Response(
        JSON.stringify({ 
          response: crisisResponse,
          is_health_related: true,
          is_crisis: true,
          crisis_type: crisisCheck.type,
          language: detectedLang
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try Anthropic Claude first (preferred for healthcare)
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Build conversation messages
    const messages = [
      ...conversation_history.slice(-6).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: query }
    ];

    let response: string | null = null;
    let modelUsed = '';

    // Try Anthropic first (best for healthcare)
    if (anthropicApiKey) {
      try {
        console.log('[Healthcare Triage] Using Anthropic Claude...');
        
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024, // Increased to prevent cutoffs
            system: HEALTHCARE_TRIAGE_SYSTEM_PROMPT,
            messages: messages
          }),
        });

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          response = data.content?.[0]?.text || '';
          modelUsed = 'claude-sonnet-4-20250514';
          console.log(`[Healthcare Triage] Claude response: ${response?.substring(0, 50)}...`);
        } else {
          const errorText = await anthropicResponse.text();
          console.error('[Healthcare Triage] Anthropic error:', anthropicResponse.status, errorText);
        }
      } catch (err) {
        console.error('[Healthcare Triage] Anthropic exception:', err);
      }
    }

    // Fallback to Lovable AI (Gemini)
    if (!response && lovableApiKey) {
      try {
        console.log('[Healthcare Triage] Using Lovable AI (Gemini)...');
        
        // Simplified system prompt for Gemini
        const geminiSystemPrompt = `You are a friendly, empathetic healthcare triage assistant. You help with health-related questions through a voice interface.

RULES:
- Keep responses to 2-3 sentences (voice interface)
- Never diagnose - say "symptoms that may warrant evaluation"
- Always recommend seeing a healthcare provider
- If off-topic, gently redirect to health topics
- Respond in the same language the user speaks
- Show empathy first, then provide helpful information
- For emergencies: direct to 911 or ER immediately

SAFETY: If someone mentions self-harm, immediately provide crisis resources (988 Suicide Lifeline) and express concern.`;

        const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: geminiSystemPrompt },
              ...messages
            ],
            max_tokens: 1024, // Increased to prevent cutoffs
          }),
        });

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          response = data.choices?.[0]?.message?.content || '';
          modelUsed = 'google/gemini-2.5-flash';
          console.log(`[Healthcare Triage] Gemini response: ${response?.substring(0, 50)}...`);
        } else {
          const errorText = await geminiResponse.text();
          console.error('[Healthcare Triage] Lovable AI error:', geminiResponse.status, errorText);
          
          if (geminiResponse.status === 429) {
            return new Response(
              JSON.stringify({ 
                response: "I'm receiving many questions right now. Please try again in a moment. If you're experiencing a medical emergency, please call 911.",
                is_health_related: true
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (err) {
        console.error('[Healthcare Triage] Lovable AI exception:', err);
      }
    }

    // If no AI response, provide a helpful fallback
    if (!response) {
      console.log('[Healthcare Triage] No AI available, using fallback');
      
      const fallbackResponses: Record<string, string> = {
        'en': "I understand you have a health question. While I'm having trouble connecting right now, I want you to know your health matters. Please consult a healthcare provider for personalized advice, or call 911 if it's an emergency.",
        'es': "Entiendo que tienes una pregunta de salud. Aunque tengo problemas de conexión ahora, quiero que sepas que tu salud importa. Por favor consulta a un profesional de salud, o llama al 911 si es una emergencia.",
        'fr': "Je comprends que vous avez une question de santé. Bien que j'aie des problèmes de connexion, votre santé est importante. Veuillez consulter un professionnel de santé, ou appelez le 15 si c'est une urgence.",
        'de': "Ich verstehe, dass Sie eine Gesundheitsfrage haben. Obwohl ich Verbindungsprobleme habe, ist Ihre Gesundheit wichtig. Bitte konsultieren Sie einen Arzt, oder rufen Sie 112 an, wenn es ein Notfall ist."
      };
      
      response = fallbackResponses[detectedLang] || fallbackResponses['en'];
      modelUsed = 'fallback';
    }

    console.log(`[Healthcare Triage] Final response (${modelUsed}): ${response.length} chars`);

    return new Response(
      JSON.stringify({ 
        response,
        is_health_related: true,
        model_used: modelUsed,
        language: detectedLang
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Healthcare Triage] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'I apologize, but I encountered an issue. If you have a medical emergency, please call 911 or go to your nearest emergency room.',
        is_health_related: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
