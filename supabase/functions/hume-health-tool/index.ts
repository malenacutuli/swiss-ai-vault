import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Health topic classifier - returns true if query is health-related
function isHealthRelated(query: string): boolean {
  const healthKeywords = [
    // Medical conditions
    'health', 'medical', 'doctor', 'medicine', 'symptom', 'diagnosis', 'treatment',
    'disease', 'illness', 'condition', 'pain', 'ache', 'fever', 'cough', 'cold',
    'flu', 'infection', 'virus', 'bacteria', 'allergy', 'asthma', 'diabetes',
    'blood pressure', 'hypertension', 'cholesterol', 'heart', 'cancer', 'tumor',
    'headache', 'migraine', 'anxiety', 'depression', 'stress', 'sleep', 'insomnia',
    'nausea', 'dizzy', 'fatigue', 'tired', 'weak', 'sore', 'swollen', 'rash',
    'breathing', 'chest', 'stomach', 'digest', 'weight', 'diet', 'nutrition',
    
    // Body parts  
    'head', 'neck', 'back', 'leg', 'arm', 'joint', 'muscle', 'bone',
    'skin', 'eye', 'ear', 'throat', 'lung', 'liver', 'kidney', 'brain',
    
    // Healthcare
    'hospital', 'clinic', 'pharmacy', 'prescription', 'medication', 'drug', 'pill',
    'vaccine', 'immunization', 'surgery', 'procedure', 'therapy', 'rehabilitation',
    'insurance', 'coverage', 'prior authorization', 'claim', 'copay', 'deductible',
    
    // Wellness
    'exercise', 'fitness', 'bmi', 'calories', 'vitamin', 'supplement', 'wellness',
    'mental health', 'physical', 'hurt', 'sick', 'ill', 'unwell',
    
    // Medical codes
    'icd', 'cpt', 'npi', 'diagnosis code', 'procedure code',
    
    // Professionals
    'physician', 'nurse', 'specialist', 'therapist', 'psychiatrist', 'cardiologist',
    'dermatologist', 'pediatrician', 'surgeon', 'pharmacist'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for health keywords
  const hasHealthKeyword = healthKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // Also check for common health question patterns
  const healthPatterns = [
    /what (is|are|causes?|helps?)/i,
    /how (do|can|to) (treat|cure|help|stop|prevent)/i,
    /should i (see|go|take|eat|avoid)/i,
    /i (have|feel|am having|got) (a |an )?/i,
  ];
  
  const matchesPattern = healthPatterns.some(pattern => pattern.test(query));
  
  return hasHealthKeyword || matchesPattern;
}

// Non-health response for off-topic queries
const OFF_TOPIC_RESPONSE = `I'm your health assistant, and I'm here to help with health-related questions only. I can assist you with:

• Understanding symptoms and conditions
• Explaining medications and treatments  
• Navigating health insurance and claims
• Finding medical codes (ICD-10, CPT)
• General wellness and nutrition guidance

Please ask me a health-related question, and I'll be happy to help!`;

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

    console.log(`[Hume Health] Query: ${query.substring(0, 100)}...`);

    // Check if query is health-related
    if (!isHealthRelated(query)) {
      console.log('[Hume Health] Off-topic query detected');
      return new Response(
        JSON.stringify({ 
          response: OFF_TOPIC_RESPONSE,
          is_health_related: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Lovable AI (no rate limits) for health responses
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      console.log('[Hume Health] No Lovable API key, using basic response');
      return new Response(
        JSON.stringify({
          response: `I understand you're asking about: "${query}". While I can provide general health information, please consult a healthcare professional for personalized medical advice. Is there a specific aspect of this health topic you'd like me to explain?`,
          is_health_related: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Health-focused system prompt for voice conversations
    const systemPrompt = `You are a friendly, empathetic health assistant speaking through a voice interface. Your responses should be:

1. CONVERSATIONAL: Speak naturally as if talking to a friend. Avoid bullet points and lists - use flowing sentences.
2. CONCISE: Keep responses to 2-3 short sentences. Voice conversations require brevity.
3. ACCURATE: Only provide information you're confident about. If unsure, say so.
4. SAFE: Always recommend consulting a healthcare professional for serious concerns.
5. EMPATHETIC: Acknowledge the person's concerns before providing information.

IMPORTANT CONSTRAINTS:
- Do NOT provide specific medical diagnoses
- Do NOT recommend specific prescription medications
- Do NOT provide dosage information
- ALWAYS suggest seeing a doctor for persistent or severe symptoms
- If asked about emergencies, direct to call 911 or go to the ER

Keep your response SHORT - ideal for being spoken aloud. Maximum 3 sentences.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-4).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: query }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 200, // Very concise for voice
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Hume Health] Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            response: "I'm receiving a lot of questions right now. Please try again in a moment.",
            is_health_related: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Add a brief disclaimer for voice
    if (content && !content.includes('consult')) {
      content += ' Please consult a healthcare provider for personalized advice.';
    }

    console.log(`[Hume Health] Response generated (${content.length} chars)`);

    return new Response(
      JSON.stringify({ 
        response: content,
        is_health_related: true,
        model_used: 'google/gemini-2.5-flash'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Hume Health] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'I apologize, but I encountered an issue processing your question. Could you please try asking again?',
        is_health_related: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
