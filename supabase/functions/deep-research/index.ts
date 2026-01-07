import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }
    
    const { query, depth, sources } = await req.json();
    
    if (!query) {
      throw new Error("Missing query");
    }
    
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }
    
    console.log(`[deep-research] Starting research for user ${user.id}: "${query.slice(0, 50)}..."`);
    
    // Create research job record
    const { data: job, error: jobError } = await supabase
      .from("deep_research_jobs")
      .insert({
        user_id: user.id,
        query,
        depth: depth || "standard",
        status: "running",
      })
      .select()
      .single();
    
    if (jobError) {
      console.error(`[deep-research] Job creation error:`, jobError);
      throw new Error(`Failed to create job: ${jobError.message}`);
    }
    
    // Start deep research with Gemini (background execution)
    executeDeepResearch(supabase, apiKey, job.id, query, depth, sources);
    
    return new Response(JSON.stringify({
      job_id: job.id,
      status: "running",
      message: "Research started. Poll /deep-research-status for updates.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[deep-research] Error: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeDeepResearch(
  supabase: any,
  apiKey: string,
  jobId: string,
  query: string,
  depth: string,
  _sources?: any[]
) {
  try {
    console.log(`[deep-research] Executing research job ${jobId}`);
    
    // Use Gemini with web grounding for deep research
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a research analyst. Conduct comprehensive research on: "${query}"
              
              Depth: ${depth}
              
              Provide:
              1. Executive Summary
              2. Key Findings (with citations)
              3. Analysis
              4. Recommendations
              5. Sources Used
              
              Format as a professional research report.`,
            }],
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
          tools: [{
            googleSearch: {},  // Enable web grounding
          }],
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Research API error: ${errorText}`);
    }
    
    const data = await response.json();
    const report = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    
    // Extract citations
    const citations = groundingMetadata?.webSearchQueries || [];
    
    console.log(`[deep-research] Research completed for job ${jobId}`);
    
    // Update job with results
    await supabase.from("deep_research_jobs").update({
      status: "completed",
      report,
      citations,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[deep-research] Research error for job ${jobId}: ${error.message}`);
    
    await supabase.from("deep_research_jobs").update({
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}
