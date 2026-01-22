import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Body parts
    'head', 'chest', 'stomach', 'back', 'leg', 'arm', 'joint', 'muscle', 'bone',
    'skin', 'eye', 'ear', 'throat', 'lung', 'liver', 'kidney', 'brain',
    
    // Healthcare
    'hospital', 'clinic', 'pharmacy', 'prescription', 'medication', 'drug', 'pill',
    'vaccine', 'immunization', 'surgery', 'procedure', 'therapy', 'rehabilitation',
    'insurance', 'coverage', 'prior authorization', 'claim', 'copay', 'deductible',
    
    // Wellness
    'nutrition', 'diet', 'exercise', 'fitness', 'weight', 'bmi', 'calories',
    'vitamin', 'supplement', 'wellness', 'mental health', 'physical',
    
    // Medical codes
    'icd', 'cpt', 'npi', 'diagnosis code', 'procedure code',
    
    // Professionals
    'physician', 'nurse', 'specialist', 'therapist', 'psychiatrist', 'cardiologist',
    'dermatologist', 'pediatrician', 'surgeon', 'pharmacist'
  ];
  
  const lowerQuery = query.toLowerCase();
  return healthKeywords.some(keyword => lowerQuery.includes(keyword));
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
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query, conversation_history = [] } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Hume Health] Query from user ${user.id}: ${query.substring(0, 100)}...`);

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

    // Forward to healthcare-query function
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicApiKey) {
      // Fallback to a simpler response if no Anthropic key
      console.log('[Hume Health] No Anthropic key, using basic response');
      return new Response(
        JSON.stringify({
          response: `I understand you're asking about: "${query}". While I can provide general health information, please consult a healthcare professional for personalized medical advice. Is there a specific aspect of this health topic you'd like me to explain?`,
          is_health_related: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Claude for health responses with a focused system prompt
    const systemPrompt = `You are a friendly, empathetic health assistant speaking through a voice interface. Your responses should be:

1. CONVERSATIONAL: Speak naturally as if talking to a friend. Avoid bullet points and lists - use flowing sentences.
2. CONCISE: Keep responses to 2-3 short paragraphs. Voice conversations require brevity.
3. ACCURATE: Only provide information you're confident about. If unsure, say so.
4. SAFE: Always recommend consulting a healthcare professional for serious concerns.
5. EMPATHETIC: Acknowledge the person's concerns before providing information.

IMPORTANT CONSTRAINTS:
- Do NOT provide specific medical diagnoses
- Do NOT recommend specific prescription medications without context
- Do NOT provide dosage information
- ALWAYS suggest seeing a doctor for persistent or severe symptoms
- If asked about emergencies, direct to call 911 or go to the ER

You have access to clinical knowledge about:
- Common symptoms and conditions
- General wellness and prevention
- Health insurance and billing concepts
- Medical terminology explanations

Remember: You're having a voice conversation, so be warm and natural.`;

    const messages = [
      ...conversation_history.slice(-6).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: query }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500, // Keep responses concise for voice
        system: systemPrompt,
        messages
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Hume Health] Claude error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    let content = '';
    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

    // Add a brief disclaimer for voice
    content += '\n\nRemember, this is general information only. Please consult a healthcare provider for personalized advice.';

    console.log(`[Hume Health] Response generated (${content.length} chars)`);

    return new Response(
      JSON.stringify({ 
        response: content,
        is_health_related: true,
        model_used: 'claude-sonnet-4-20250514'
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
