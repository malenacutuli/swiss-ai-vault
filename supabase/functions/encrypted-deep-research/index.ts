import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Perplexity model pricing (per million tokens / per 1000 searches)
const MODEL_PRICING: Record<string, { input: number; output: number; search: number }> = {
  "sonar": { input: 1, output: 1, search: 5 },
  "sonar-pro": { input: 3, output: 15, search: 10 },
  "sonar-reasoning": { input: 1, output: 5, search: 5 },
  "sonar-reasoning-pro": { input: 2, output: 8, search: 10 },
  "sonar-deep-research": { input: 2, output: 8, search: 5 }
};

// Tier to default model mapping
const TIER_MODELS: Record<string, string> = {
  "free": "sonar",
  "pro": "sonar-reasoning-pro",
  "team": "sonar-reasoning-pro",
  "enterprise": "sonar-deep-research"
};

interface EncryptedResearchRequest {
  queryEncrypted?: string;
  queryNonce?: string;
  queryPlaintext?: string;
  conversationId?: string;
  isZeroTraceEnabled: boolean;
  model?: string;
  includeDocuments?: boolean;
  documentIds?: string[];
}

interface ResearchResponse {
  content: string;
  citations: Array<{
    url: string;
    title: string;
    snippet?: string;
  }>;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    searchQueries: number;
    reasoningTokens?: number;
  };
  cost: number;
  processingTime: number;
  researchQueryId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate API key exists
    if (!PERPLEXITY_API_KEY) {
      console.error("PERPLEXITY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Research service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's subscription tier from billing_customers
    const { data: billingCustomer } = await supabase
      .from("billing_customers")
      .select("tier, subscription_status")
      .eq("user_id", user.id)
      .eq("subscription_status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tier = billingCustomer?.tier || "free";

    // Get quota
    const { data: quota } = await supabase
      .from("research_quotas")
      .select("*")
      .eq("tier", tier)
      .maybeSingle();

    if (!quota) {
      console.error("Quota configuration not found for tier:", tier);
      return new Response(
        JSON.stringify({ error: "Quota configuration not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check usage this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: usageCount } = await supabase
      .from("research_queries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", startOfMonth.toISOString());

    if (quota.monthly_queries !== -1 && (usageCount || 0) >= quota.monthly_queries) {
      return new Response(
        JSON.stringify({
          error: "Monthly research quota exceeded",
          usage: usageCount,
          limit: quota.monthly_queries,
          tier
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: EncryptedResearchRequest = await req.json();
    const {
      queryEncrypted,
      queryNonce,
      queryPlaintext,
      conversationId,
      isZeroTraceEnabled,
      includeDocuments,
      documentIds
    } = body;

    // The client must send plaintext for API call (Perplexity needs it)
    // When ZeroTrace is ON, encrypted version is stored but plaintext is used for API
    const queryForApi = queryPlaintext;
    
    if (!queryForApi) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select model based on tier
    let model = body.model || TIER_MODELS[tier];

    // Validate model is allowed for tier
    if (!quota.models_allowed?.includes(model)) {
      model = TIER_MODELS[tier];
    }

    // Check if deep research is enabled for this tier
    if (model === "sonar-deep-research" && !quota.deep_research_enabled) {
      model = "sonar-reasoning-pro";
    }

    console.log(`User ${user.id} (tier: ${tier}) starting research with model: ${model}`);

    // Create research query record
    const { data: researchQuery, error: insertError } = await supabase
      .from("research_queries")
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        query_encrypted: isZeroTraceEnabled ? queryEncrypted : null,
        query_nonce: isZeroTraceEnabled ? queryNonce : null,
        query_plaintext: isZeroTraceEnabled ? null : queryPlaintext,
        is_encrypted: isZeroTraceEnabled,
        model,
        mode: isZeroTraceEnabled ? "encrypted" : "privacy-enhanced",
        status: "processing"
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create research query:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to initiate research" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build system prompt
    let systemPrompt = `You are a research assistant for SwissVault, a Swiss-hosted AI platform focused on privacy and data sovereignty.

When conducting research:
1. Be thorough and comprehensive in your analysis
2. Always cite your sources with URLs using [N] notation
3. Present information in a clear, structured format
4. Highlight key findings and actionable insights
5. Note any limitations or areas where more research may be needed
6. Be objective and present multiple perspectives when relevant

Format your response with:
## Executive Summary
A 2-3 sentence overview of the key findings.

## Key Findings
- Finding 1 [1]
- Finding 2 [2,3]
- Additional findings...

## Detailed Analysis
Organized analysis by topic with inline citations.

## Sources
Numbered list of all sources referenced.`;

    // If including user documents, fetch and add to context
    let documentContext = "";
    if (includeDocuments && documentIds?.length) {
      // Fetch from document_chunks table (where RAG data is stored)
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("filename, content")
        .in("id", documentIds)
        .eq("user_id", user.id);

      if (chunks?.length) {
        documentContext = "\n\nUser's Documents for Reference:\n" +
          chunks.map(d => `### ${d.filename}\n${d.content?.substring(0, 5000)}`).join("\n\n");

        systemPrompt += `\n\nThe user has provided documents from their encrypted vault. Reference these when relevant, and indicate vault sources with [Vault] prefix.`;
      }
    }

    // Call Perplexity API
    console.log(`Calling Perplexity API with model: ${model}`);
    
    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: queryForApi + documentContext }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        return_citations: true,
        return_images: false,
        search_recency_filter: "month"
      })
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error("Perplexity API error:", perplexityResponse.status, errorText);

      // Update status to failed
      await supabase
        .from("research_queries")
        .update({ status: "failed" })
        .eq("id", researchQuery.id);

      return new Response(
        JSON.stringify({ 
          error: "Research service error",
          details: perplexityResponse.status === 429 ? "Rate limited" : "Service unavailable"
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    
    // Extract response content
    const content = perplexityData.choices?.[0]?.message?.content || "";
    const citations = perplexityData.citations || [];
    
    // Extract usage
    const usage = {
      inputTokens: perplexityData.usage?.prompt_tokens || 0,
      outputTokens: perplexityData.usage?.completion_tokens || 0,
      searchQueries: perplexityData.usage?.num_search_queries || 1,
      reasoningTokens: perplexityData.usage?.reasoning_tokens || 0
    };

    // Calculate cost
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["sonar"];
    const cost = 
      (usage.inputTokens / 1_000_000) * pricing.input +
      (usage.outputTokens / 1_000_000) * pricing.output +
      (usage.searchQueries / 1000) * pricing.search;

    const processingTime = Date.now() - startTime;

    console.log(`Research completed in ${processingTime}ms, cost: $${cost.toFixed(6)}`);

    // Update research query with results
    await supabase
      .from("research_queries")
      .update({
        status: "completed",
        citations_plaintext: isZeroTraceEnabled ? null : citations,
        search_queries_count: usage.searchQueries,
        reasoning_tokens: usage.reasoningTokens,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_cost: cost,
        processing_time_ms: processingTime
      })
      .eq("id", researchQuery.id);

    // Return response - client will encrypt if ZeroTrace is enabled
    const response: ResearchResponse = {
      content,
      citations: citations.map((url: string, i: number) => ({
        url,
        title: `Source ${i + 1}`,
        snippet: ""
      })),
      model,
      usage,
      cost,
      processingTime,
      researchQueryId: researchQuery.id
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Encrypted deep research error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
