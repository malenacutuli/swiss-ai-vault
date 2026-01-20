// Healthcare Query Edge Function
// Agentic loop with Claude tool use for medical queries

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  HEALTHCARE_TOOLS,
  HEALTHCARE_PROMPTS,
  BASE_DISCLAIMER,
  executeTool
} from '../_shared/healthcare-tools/index.ts';
import { authenticateToken } from '../_shared/cross-project-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TOOL_ITERATIONS = 8;

interface Message {
  role: 'user' | 'assistant';
  content: any;
}

interface ToolCall {
  tool: string;
  input: Record<string, any>;
  output: any;
  source?: string;
  source_url?: string;
  success?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  console.log(`[Healthcare] [${requestId}] Request started - v2.1.0`);

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const authHeader = req.headers.get('Authorization');

    console.log(`[Healthcare] [${requestId}] Env check:`, {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      hasAnthropicKey: !!anthropicApiKey,
      hasOpenAIKey: !!openaiApiKey,
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length || 0
    });

    if (!authHeader) {
      console.log(`[Healthcare] [${requestId}] No auth header provided`);
      return new Response(
        JSON.stringify({ error: 'Authorization required', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth client with Authorization header (matches ghost-inference pattern)
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try standard Supabase auth first (works for local tokens)
    console.log(`[Healthcare] [${requestId}] Attempting local auth...`);
    const { data: { user: localUser }, error: localError } = await authClient.auth.getUser();

    console.log(`[Healthcare] [${requestId}] Local auth result:`, {
      hasUser: !!localUser,
      userId: localUser?.id?.slice(0, 8),
      error: localError?.message,
      errorCode: localError?.code
    });

    let user = localUser;

    // If local auth fails, try cross-project auth for Lovable tokens
    if (localError || !localUser) {
      console.log(`[Healthcare] [${requestId}] Local auth failed, trying cross-project...`);

      const token = authHeader.replace('Bearer ', '');
      console.log(`[Healthcare] [${requestId}] Token extracted, length: ${token.length}`);

      // Wrap in try-catch to handle any uncaught exceptions
      let authResult;
      try {
        authResult = await authenticateToken(token, authClient);
      } catch (authError) {
        console.error(`[Healthcare] [${requestId}] authenticateToken threw:`, authError);
        return new Response(
          JSON.stringify({
            error: 'Authentication processing error',
            details: authError instanceof Error ? authError.message : String(authError),
            requestId
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Healthcare] [${requestId}] Cross-project auth result:`, {
        source: authResult?.source,
        hasUser: !!authResult?.user,
        userId: authResult?.user?.id?.slice(0, 8),
        error: authResult?.error
      });

      if (!authResult || authResult.error || !authResult.user) {
        const errorMsg = authResult?.error || 'Invalid authentication token';
        console.log(`[Healthcare] [${requestId}] Auth failed with error: ${errorMsg}`);
        return new Response(
          JSON.stringify({ error: errorMsg, requestId }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      user = authResult.user as any;
      console.log(`[Healthcare] [${requestId}] Cross-project auth success, user: ${user!.id.slice(0, 8)}`);
    } else {
      console.log(`[Healthcare] [${requestId}] Local auth success, user: ${localUser.id.slice(0, 8)}`);
    }

    // Check subscription from multiple sources (unified_subscriptions AND billing_customers)
    // Also check user_settings for admin/beta access
    const allowedTiers = ['ghost_pro', 'ghost_premium', 'ghost_enterprise', 'pro', 'premium', 'enterprise', 'vault_pro', 'team', 'beta_tester'];

    // Check unified_subscriptions first
    const { data: subscription, error: subError } = await (supabase
      .from('unified_subscriptions') as any)
      .select('tier, status')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .maybeSingle();

    // Also check billing_customers as fallback
    const { data: billing, error: billingError } = await supabase
      .from('billing_customers')
      .select('tier, subscription_status')
      .eq('user_id', user!.id)
      .maybeSingle();

    // Check user_settings for admin or beta access
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('account_type, feature_access')
      .eq('user_id', user!.id)
      .maybeSingle();

    const subscriptionTier = subscription?.tier || (billing as any)?.tier || 'free';
    const accountType = (userSettings as any)?.account_type;
    const isAdmin = user!.email?.includes('axessible.ai') || accountType === 'admin';
    const isBetaTester = accountType === 'beta_tester';

    console.log(`[Healthcare] [${requestId}] Access check:`, {
      userId: user!.id.slice(0, 8),
      subscriptionTier,
      accountType,
      isAdmin,
      isBetaTester,
      billingTier: (billing as any)?.tier,
      unifiedTier: subscription?.tier
    });

    // Allow access for: pro+ tiers, admins, beta testers
    const hasAccess = allowedTiers.includes(subscriptionTier) || isAdmin || isBetaTester;

    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          error: 'Healthcare features require Pro subscription or higher',
          current_tier: subscriptionTier,
          hint: 'Upgrade to Ghost Pro at /ghost/pricing'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const {
      query,
      task_type = 'general_query',
      context_chunks = [],
      conversation_history = []
    } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt
    const systemPrompt = HEALTHCARE_PROMPTS[task_type] || HEALTHCARE_PROMPTS.general_query;

    // Build user content with context
    let userContent = query;
    if (context_chunks.length > 0) {
      const contextText = context_chunks
        .map((c: any) => typeof c === 'string' ? c : `[Document: ${c.filename}]\n${c.content}`)
        .join('\n\n---\n\n');
      userContent = `## Uploaded Documents\n\n${contextText}\n\n---\n\n## Query\n\n${query}`;
    }

    // Build messages
    const messages: Message[] = [
      ...conversation_history,
      { role: 'user', content: userContent }
    ];

    // Select model based on task complexity
    const useComplexModel = ['prior_auth_review', 'claims_appeal', 'clinical_documentation'].includes(task_type);

    let response: any;
    let modelUsed: string;
    let usedFallback = false;
    const allToolCalls: ToolCall[] = [];

    // Try Anthropic first
    if (anthropicApiKey) {
      try {
        modelUsed = useComplexModel ? 'claude-opus-4-20250514' : 'claude-sonnet-4-20250514';

        let iterations = 0;
        let currentMessages = [...messages];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        // AGENTIC TOOL USE LOOP
        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;
          console.log(`[Healthcare] Iteration ${iterations}`);

          const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: modelUsed,
              max_tokens: 4096,
              system: systemPrompt,
              tools: HEALTHCARE_TOOLS,
              messages: currentMessages.map(m => ({
                role: m.role,
                content: m.content
              }))
            }),
          });

          if (!anthropicResponse.ok) {
            const errorText = await anthropicResponse.text();
            throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`);
          }

          const data = await anthropicResponse.json();

          totalInputTokens += data.usage?.input_tokens || 0;
          totalOutputTokens += data.usage?.output_tokens || 0;

          // Check if Claude wants to use tools
          if (data.stop_reason === 'tool_use') {
            const assistantContent: any[] = [];
            const toolResults: any[] = [];

            for (const block of data.content || []) {
              if (block.type === 'tool_use') {
                console.log(`[Healthcare] Tool call: ${block.name}`, JSON.stringify(block.input));

                // Execute the tool
                const toolOutput = await executeTool(block.name, block.input);

                allToolCalls.push({
                  tool: block.name,
                  input: block.input,
                  output: toolOutput.data || toolOutput.error,
                  source: toolOutput.source,
                  source_url: toolOutput.source_url,
                  success: toolOutput.success
                });

                assistantContent.push(block);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(toolOutput.data || { error: toolOutput.error })
                });
              } else {
                assistantContent.push(block);
              }
            }

            // Add to conversation for next iteration
            currentMessages.push({ role: 'assistant', content: assistantContent });
            currentMessages.push({ role: 'user', content: toolResults });

          } else {
            // Claude is done - extract final response
            let content = '';
            for (const block of data.content || []) {
              if (block.type === 'text') {
                content += block.text;
              }
            }

            response = {
              content: content + BASE_DISCLAIMER,
              model_used: modelUsed,
              input_tokens: totalInputTokens,
              output_tokens: totalOutputTokens,
              provider: 'anthropic',
              tool_calls: allToolCalls,
              tool_calls_count: allToolCalls.length,
              iterations
            };

            break;
          }
        }

        // Max iterations reached
        if (!response) {
          // Get final text from last iteration
          let finalContent = "I've gathered the relevant information. Based on the tool results above, here's my analysis:\n\n";

          // Summarize tool results
          for (const tc of allToolCalls) {
            finalContent += `**${tc.tool}**: Retrieved ${JSON.stringify(tc.output).length > 100 ? 'data' : tc.output}\n\n`;
          }

          response = {
            content: finalContent + BASE_DISCLAIMER,
            model_used: modelUsed,
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            provider: 'anthropic',
            tool_calls: allToolCalls,
            tool_calls_count: allToolCalls.length,
            iterations,
            max_iterations_reached: true
          };
        }

      } catch (anthropicError) {
        console.error('[Healthcare] Anthropic API error:', anthropicError);
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    // OpenAI fallback (simplified - no tool use)
    if (usedFallback) {
      if (!openaiApiKey) {
        return new Response(
          JSON.stringify({ error: 'No AI provider available' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      modelUsed = useComplexModel ? 'gpt-4o' : 'gpt-4o-mini';

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: modelUsed,
          max_tokens: 4096,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }))
          ]
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const openaiData = await openaiResponse.json();

      response = {
        content: (openaiData.choices?.[0]?.message?.content || '') + BASE_DISCLAIMER,
        model_used: modelUsed,
        input_tokens: openaiData.usage?.prompt_tokens || 0,
        output_tokens: openaiData.usage?.completion_tokens || 0,
        provider: 'openai',
        fallback: true,
        tool_calls: [],
        tool_calls_count: 0
      };
    }

    const latencyMs = Date.now() - startTime;

    // Log usage for billing (non-blocking)
    try {
      await supabase.from('healthcare_usage').insert({
        user_id: user!.id,
        task_type,
        query_length: query.length,
        response_length: response.content?.length || 0,
        tool_calls: response.tool_calls_count || 0,
        created_at: new Date().toISOString(),
      } as Record<string, unknown>);
    } catch (err) {
      console.error('Usage logging error:', err);
    }

    // Audit log (non-blocking)
    try {
      await supabase.from('healthcare_audit_log').insert({
        user_id: user!.id,
        action: 'query_sent',
        task_type,
        model_used: response.model_used,
        tool_calls_count: response.tool_calls_count,
        ip_address: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent')
      } as Record<string, unknown>);
    } catch { /* Non-blocking */ }

    return new Response(
      JSON.stringify({
        ...response,
        latency_ms: latencyMs,
        task_type
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Healthcare] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
