import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DURATION_WORDS = {
  short: 500,    // ~3-5 min
  medium: 1000,  // ~7-10 min
  long: 2000,    // ~15-20 min
};

const FORMAT_PROMPTS = {
  deep_dive: "Create a comprehensive, detailed discussion exploring all aspects of these documents.",
  quick_brief: "Create a concise executive summary hitting only the most critical points.",
  debate: "Create a balanced debate with Alex taking one perspective and Jordan taking another.",
  critique: "Create a critical analysis examining strengths, weaknesses, and potential issues.",
  tutorial: "Create an educational walkthrough explaining concepts step by step.",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    const { documents, format = 'deep_dive', duration = 'medium', title } = await req.json();

    if (!documents || documents.length === 0) {
      throw new Error('At least one document is required');
    }

    // Aggregate document content
    const documentContent = documents.map((doc: { title: string; content: string }, i: number) => 
      `=== Document ${i + 1}: ${doc.title} ===\n${doc.content}`
    ).join('\n\n');

    const targetWords = DURATION_WORDS[duration as keyof typeof DURATION_WORDS] || 1000;

    // Step 1: Generate outline using Gemini
    console.log('[audio-briefing] Generating outline...');
    
    const outlineResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Analyze these documents and create an outline for an audio briefing.

Documents:
${documentContent.substring(0, 20000)}

Return a JSON object with:
{
  "title": "Briefing title",
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
      const errText = await outlineResponse.text();
      console.error('[audio-briefing] Outline error:', errText);
      throw new Error('Failed to generate outline');
    }
    
    const outlineData = await outlineResponse.json();
    const outlineText = outlineData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let outline;
    try {
      outline = JSON.parse(outlineText.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      console.error('[audio-briefing] Failed to parse outline:', outlineText);
      outline = { title: 'Audio Briefing', keyThemes: [], keyFacts: [], questions: [] };
    }

    // Step 2: Generate dialogue script using Gemini
    console.log('[audio-briefing] Generating dialogue script...');
    
    const dialogueResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Create a natural podcast-style dialogue between two hosts discussing these documents.

Host Personas:
- Alex: The curious one who asks insightful questions and seeks clarity
- Jordan: The expert who provides detailed explanations and insights

Style Guidelines:
- ${FORMAT_PROMPTS[format as keyof typeof FORMAT_PROMPTS]}
- Make it conversational and engaging
- Include natural transitions and back-and-forth
- Target approximately ${targetWords} words total
- Reference specific facts from the documents
- End with key takeaways

Outline to follow:
${JSON.stringify(outline, null, 2)}

Document content:
${documentContent.substring(0, 15000)}

Return a JSON array of dialogue parts:
[
  {"speaker": "Alex", "text": "..."},
  {"speaker": "Jordan", "text": "..."},
  ...
]

Only return valid JSON array, no markdown.`
            }]
          }],
          generationConfig: { 
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!dialogueResponse.ok) {
      const errText = await dialogueResponse.text();
      console.error('[audio-briefing] Dialogue error:', errText);
      throw new Error('Failed to generate dialogue');
    }
    
    const dialogueData = await dialogueResponse.json();
    const dialogueText = dialogueData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    let dialogue: Array<{ speaker: 'Alex' | 'Jordan'; text: string }>;
    try {
      dialogue = JSON.parse(dialogueText.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      console.error('[audio-briefing] Failed to parse dialogue:', dialogueText);
      dialogue = [
        { speaker: 'Alex', text: 'Welcome to this audio briefing.' },
        { speaker: 'Jordan', text: 'Unfortunately, we encountered an issue generating the full dialogue.' }
      ];
    }

    // Step 3: Generate audio for each dialogue part
    console.log('[audio-briefing] Generating audio for', dialogue.length, 'parts...');
    
    const audioChunks: Uint8Array[] = [];
    
    for (let i = 0; i < dialogue.length; i++) {
      const part = dialogue[i];
      const voice = part.speaker === 'Alex' ? 'alloy' : 'nova';
      
      console.log(`[audio-briefing] TTS ${i + 1}/${dialogue.length}: ${part.speaker}`);
      
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
        console.error(`[audio-briefing] TTS failed for ${part.speaker}:`, await ttsResponse.text());
        continue;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      audioChunks.push(new Uint8Array(audioBuffer));
    }

    // Combine audio chunks
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Convert to base64 using Deno's encoding library (handles large buffers)
    const audioBase64 = base64Encode(combinedAudio.buffer);

    console.log('[audio-briefing] Complete! Audio size:', combinedAudio.byteLength, 'bytes');

    return new Response(JSON.stringify({
      title: title || outline.title || 'Audio Briefing',
      format,
      duration,
      audioDataUrl: `data:audio/mpeg;base64,${audioBase64}`,
      transcript: dialogue,
      outline,
      status: 'ready',
      createdAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[audio-briefing] Error:', message);
    return new Response(JSON.stringify({ 
      error: message,
      status: 'error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
