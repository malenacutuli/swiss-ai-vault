import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrowserActionRequest {
  action: 'navigate' | 'screenshot' | 'click' | 'type' | 'fill_form' | 'extract' | 
          'get_cookies' | 'set_cookies' | 'evaluate' | 'wait' | 'scroll' | 'multi_step' | 
          'scrape' | 'workflow';
  url?: string;
  selector?: string;
  value?: string;
  options?: Record<string, unknown>;
  cookies?: Array<Record<string, unknown>>;
  use_swiss_proxy?: boolean;
  browser_type?: 'chromium' | 'firefox';
  task_id?: string;
  session_id?: string;
  workflow?: Array<Record<string, unknown>>;
  selectors?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BrowserActionRequest = await req.json();
    const { 
      action, 
      url, 
      selector, 
      value, 
      options, 
      cookies,
      use_swiss_proxy = false,
      browser_type = 'chromium',
      task_id,
      session_id,
      workflow,
      selectors,
    } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[browser-action] User ${user.id} executing ${action}`);

    // Get or create browser session
    let sessionData: Record<string, unknown> | null = null;
    
    if (session_id) {
      const { data } = await supabase.from('browser_sessions').select('*').eq('id', session_id).single();
      sessionData = data;
    }

    if (!sessionData && action !== 'workflow') {
      // Create new session
      const { data: newSession } = await supabase
        .from('browser_sessions')
        .insert({
          user_id: user.id,
          task_id,
          status: 'active',
          current_url: url,
        })
        .select()
        .single();
      sessionData = newSession;
    }

    // Get Modal endpoint
    const modalEndpoint = Deno.env.get('MODAL_BROWSER_ENDPOINT') || 
                          Deno.env.get('MODAL_ENDPOINT');
    
    if (!modalEndpoint) {
      // Return simulated response for demo
      console.log('[browser-action] No Modal endpoint configured, returning simulated response');
      
      const simulatedResult = {
        success: true,
        action,
        simulated: true,
        message: 'Browser automation running in simulation mode. Configure MODAL_BROWSER_ENDPOINT for real execution.',
        data: action === 'screenshot' ? { size: 0 } : 
              action === 'extract' ? { content: 'Simulated content' } :
              action === 'navigate' ? { url, title: 'Simulated Page' } :
              { executed: action },
        session_id: sessionData?.id as string | undefined,
      };

      return new Response(
        JSON.stringify(simulatedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare request for Modal worker
    let modalPayload: Record<string, unknown>;
    let modalFunction: string;

    if (action === 'workflow' && workflow) {
      modalFunction = 'automate_workflow';
      modalPayload = {
        workflow,
        initial_url: url,
        initial_cookies: cookies,
        use_swiss_proxy,
        capture_screenshots: options?.capture_screenshots ?? true,
      };
    } else if (action === 'scrape' && selectors) {
      modalFunction = 'scrape_with_browser';
      modalPayload = {
        url,
        selectors,
        wait_for: options?.wait_for,
        scroll_to_bottom: options?.scroll_to_bottom ?? false,
        take_screenshot: options?.take_screenshot ?? true,
        use_swiss_proxy,
      };
    } else {
      modalFunction = 'execute_browser_action';
      modalPayload = {
        action,
        url,
        selector,
        value,
        options,
        cookies,
        use_swiss_proxy,
        browser_type,
      };
    }

    console.log(`[browser-action] Calling Modal function: ${modalFunction}`);

    // Call Modal worker
    const modalResponse = await fetch(`${modalEndpoint}/${modalFunction}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('MODAL_API_KEY') || ''}`,
      },
      body: JSON.stringify(modalPayload),
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      console.error(`[browser-action] Modal error: ${errorText}`);
      throw new Error(`Browser automation failed: ${modalResponse.status}`);
    }

    const result = await modalResponse.json();

    // Store browser action record
    if (sessionData?.id) {
      await supabase.from('browser_actions').insert({
        session_id: sessionData.id,
        action_type: action,
        action_data: { url, selector, value, options },
        result: result.data,
        screenshot_url: result.screenshot ? 
          `data:image/png;base64,${result.screenshot.slice(0, 100)}...` : null,
      });

      // Update session
      await supabase
        .from('browser_sessions')
        .update({
          current_url: result.data?.url || url,
          last_action_at: new Date().toISOString(),
        })
        .eq('id', sessionData.id);
    }

    // Deduct credits
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      service_type: 'browser_automation',
      credits_used: action === 'workflow' ? 5 : 1,
      description: `Browser ${action}`,
      metadata: { 
        action,
        session_id: sessionData?.id,
        url,
      },
    });

    console.log(`[browser-action] Completed ${action} successfully`);

    return new Response(
      JSON.stringify({
        success: result.success,
        session_id: sessionData?.id,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[browser-action] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Browser action failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
