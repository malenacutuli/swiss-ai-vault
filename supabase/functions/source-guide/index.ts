import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SourceGuideRequest {
  action: 'generate' | 'get' | 'regenerate';
  sourceId?: string;
  content?: string;
  filename?: string;
}

interface SourceGuide {
  title: string;
  summary: string;
  keyTopics: string[];
  suggestedQuestions: { text: string; rank: number }[];
  wordCount: number;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, sourceId, content, filename } = await req.json() as SourceGuideRequest;

    switch (action) {
      case 'generate': {
        if (!content || !sourceId) {
          throw new Error('Missing content or sourceId');
        }

        console.log(`Generating Source Guide for: ${filename}`);

        // Generate Source Guide using Gemini
        const guide = await generateSourceGuide(geminiKey, content, filename || 'Document');

        // Store in database
        const { data, error } = await supabase
          .from('source_guides')
          .upsert({
            source_id: sourceId,
            title: guide.title,
            summary: guide.summary,
            key_topics: guide.keyTopics,
            suggested_questions: guide.suggestedQuestions,
            word_count: guide.wordCount,
            confidence_score: guide.confidence,
            generated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          // Return the guide even if DB save fails
          return new Response(JSON.stringify({ 
            success: true, 
            guide: {
              id: crypto.randomUUID(),
              source_id: sourceId,
              ...guide
            },
            db_saved: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update source status to 'active'
        await supabase
          .from('sources')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', sourceId);

        return new Response(JSON.stringify({ success: true, guide: data, db_saved: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get': {
        if (!sourceId) throw new Error('Missing sourceId');

        const { data, error } = await supabase
          .from('source_guides')
          .select('*')
          .eq('source_id', sourceId)
          .single();

        // If no guide exists yet, return null (not an error)
        if (error && error.code === 'PGRST116') {
          return new Response(JSON.stringify({ success: true, guide: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, guide: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'regenerate': {
        if (!sourceId) throw new Error('Missing sourceId');

        // Fetch source info
        const { data: source } = await supabase
          .from('sources')
          .select('*')
          .eq('id', sourceId)
          .single();

        if (!source) throw new Error('Source not found');

        // Fetch content from chunks
        const { data: chunks } = await supabase
          .from('source_chunks')
          .select('content')
          .eq('source_id', sourceId)
          .order('chunk_index');

        const fullContent = chunks?.map(c => c.content).join('\n\n') || '';
        
        if (!fullContent) {
          throw new Error('No content found for source');
        }

        const guide = await generateSourceGuide(geminiKey, fullContent, source.filename);

        const { data, error } = await supabase
          .from('source_guides')
          .upsert({
            source_id: sourceId,
            title: guide.title,
            summary: guide.summary,
            key_topics: guide.keyTopics,
            suggested_questions: guide.suggestedQuestions,
            word_count: guide.wordCount,
            confidence_score: guide.confidence,
            generated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, guide: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('Source Guide Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateSourceGuide(
  apiKey: string | undefined,
  content: string, 
  filename: string
): Promise<SourceGuide> {
  const wordCount = content.split(/\s+/).length;

  const systemPrompt = `You are a document analysis specialist for SwissBrAIn, a Swiss AI research platform.
Your task is to generate a "Source Guide" for the uploaded document.

CRITICAL: Format your response EXACTLY as valid JSON with these fields:
{
  "title": "A clear, descriptive title extracted or inferred from the document (max 100 chars)",
  "summary": "A comprehensive executive summary (200-400 words) that explains what this document is about, its key arguments, and why it matters. Use **double asterisks** around important terms and concepts for bold formatting.",
  "keyTopics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "suggestedQuestions": [
    {"text": "First suggested research question based on the content?", "rank": 1},
    {"text": "Second suggested question to explore deeper?", "rank": 2},
    {"text": "Third question about implications or applications?", "rank": 3}
  ],
  "wordCount": ${wordCount},
  "confidence": 0.95
}

Guidelines for the SUMMARY:
- Start with a clear statement of what the document is about
- Highlight the main thesis or purpose
- Mention key concepts, frameworks, or methodologies
- Use **double asterisks** for important terms (e.g., **machine learning**, **intent compiler**)
- Keep it informative but scannable
- End with the significance or implications

Guidelines for KEY TOPICS:
- Extract 5 most important themes/concepts
- Make them specific and actionable
- These will become clickable chips in the UI

Guidelines for SUGGESTED QUESTIONS:
- Create 3 questions that would help a researcher explore this document
- Questions should be specific to the content, not generic
- Rank them by importance/relevance (1 = most important)`;

  const userPrompt = `Analyze this document (filename: "${filename}") and generate a Source Guide:

---
${content.substring(0, 30000)}
---

Respond with valid JSON only. Do not include any markdown code blocks or explanations.`;

  if (apiKey) {
    try {
      // Call Gemini API directly
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'I understand. I will analyze documents and return JSON-formatted Source Guides with bold markdown formatting for key terms.' }] },
              { role: 'user', parts: [{ text: userPrompt }] }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
              topP: 0.8,
              topK: 40
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log('Gemini response preview:', responseText.substring(0, 300));

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(jsonStr);
      
      return {
        title: parsed.title || filename,
        summary: parsed.summary || 'Summary generation failed.',
        keyTopics: parsed.keyTopics || [],
        suggestedQuestions: parsed.suggestedQuestions || [],
        wordCount: parsed.wordCount || wordCount,
        confidence: parsed.confidence || 0.8
      };
    } catch (error) {
      console.error('Gemini generation error:', error);
    }
  }
  
  // Fallback response when API fails or no key
  return generateFallbackGuide(content, filename, wordCount);
}

function generateFallbackGuide(content: string, filename: string, wordCount: number): SourceGuide {
  // Extract potential title from first line or filename
  const firstLine = content.split('\n').find(l => l.trim().length > 10)?.trim() || filename;
  const title = firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;

  // Extract key words (simple frequency analysis)
  const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 5);
  const wordFreq = new Map<string, number>();
  words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  const topWords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  // Generate basic summary from first paragraphs
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 50);
  let summaryText = paragraphs.slice(0, 2).join(' ').substring(0, 500);
  
  // Bold the top words in summary
  topWords.slice(0, 3).forEach(word => {
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');
    summaryText = summaryText.replace(regex, '**$1**');
  });

  return {
    title: title.replace(/\.[^.]+$/, ''), // Remove file extension
    summary: summaryText + (summaryText.length >= 500 ? '...' : ''),
    keyTopics: topWords.length > 0 ? topWords : ['Document Analysis', 'Research', 'Key Insights'],
    suggestedQuestions: [
      { text: `What are the main themes discussed in "${filename.replace(/\.[^.]+$/, '')}"?`, rank: 1 },
      { text: 'What are the key takeaways from this document?', rank: 2 },
      { text: 'How does this information apply in practice?', rank: 3 },
    ],
    wordCount,
    confidence: 0.5,
  };
}
