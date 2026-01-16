import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for generated guides (in production, use a database)
const guidesCache = new Map<string, any>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sourceId, content, filename } = await req.json();

    if (action === 'get') {
      // Retrieve cached guide
      const cachedGuide = guidesCache.get(sourceId);
      if (cachedGuide) {
        return new Response(
          JSON.stringify({ success: true, guide: cachedGuide }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, guide: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate') {
      if (!content || !sourceId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing content or sourceId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate Source Guide using AI
      const guide = await generateSourceGuide(content, filename, sourceId);
      
      // Cache the guide
      guidesCache.set(sourceId, guide);

      return new Response(
        JSON.stringify({ success: true, guide }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Source guide error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateSourceGuide(content: string, filename: string, sourceId: string) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  // Truncate content if too long
  const maxChars = 30000;
  const truncatedContent = content.length > maxChars 
    ? content.substring(0, maxChars) + '...[truncated]'
    : content;

  const wordCount = content.split(/\s+/).length;

  const prompt = `Analyze this document and create a Source Guide summary.

Document filename: ${filename}
Document content:
${truncatedContent}

---

Return a JSON object with this exact structure:
{
  "title": "A descriptive title for this document (include key concepts)",
  "summary": "A 2-3 paragraph summary using **bold** markdown for key terms and important concepts. Make it informative and highlight the main ideas.",
  "key_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "suggested_questions": [
    {"text": "A thought-provoking question about the main concept?", "rank": 1},
    {"text": "A question about practical applications or implications?", "rank": 2},
    {"text": "A question about methodology or approach?", "rank": 3}
  ]
}

Guidelines:
- Title should be compelling and descriptive
- Summary should use **bold** for 3-5 key terms
- Key topics should be 3-6 single words or short phrases
- Questions should be insightful and encourage deeper exploration
- Make the summary engaging and informative`;

  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            id: crypto.randomUUID(),
            source_id: sourceId,
            title: parsed.title || filename,
            summary: parsed.summary || 'No summary available.',
            key_topics: parsed.key_topics || [],
            suggested_questions: parsed.suggested_questions || [],
            word_count: wordCount,
            confidence_score: 0.85,
          };
        }
      }
    } catch (err) {
      console.error('Gemini API error:', err);
    }
  }

  // Fallback: Generate a basic guide without AI
  return generateFallbackGuide(content, filename, sourceId, wordCount);
}

function generateFallbackGuide(content: string, filename: string, sourceId: string, wordCount: number) {
  // Extract potential title from first line or filename
  const firstLine = content.split('\n')[0]?.trim() || filename;
  const title = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;

  // Extract key words (simple frequency analysis)
  const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 5);
  const wordFreq = new Map<string, number>();
  words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  const topWords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Generate basic summary from first paragraphs
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 50);
  const summaryText = paragraphs.slice(0, 2).join(' ').substring(0, 500);
  
  // Bold the top words in summary
  let summary = summaryText;
  topWords.slice(0, 3).forEach(word => {
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');
    summary = summary.replace(regex, '**$1**');
  });

  return {
    id: crypto.randomUUID(),
    source_id: sourceId,
    title: title.replace(/\.[^.]+$/, ''), // Remove file extension
    summary: summary + (summary.length >= 500 ? '...' : ''),
    key_topics: topWords,
    suggested_questions: [
      { text: `What are the main themes discussed in "${filename}"?`, rank: 1 },
      { text: "What are the key takeaways from this document?", rank: 2 },
      { text: "How does this information apply in practice?", rank: 3 },
    ],
    word_count: wordCount,
    confidence_score: 0.5,
  };
}
