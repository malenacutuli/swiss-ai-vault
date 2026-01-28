import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, corsHeaders } from '../_shared/cors.ts';

interface APIKeyRecord {
  id: string;
  user_id: string;
  permissions: string[];
  rate_limit_per_minute: number;
  monthly_credit_limit: number | null;
  is_active: boolean;
  expires_at: string | null;
  total_requests: number;
}

// Rate limit tracking (in-memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function validateAPIKey(
  supabase: any,
  authHeader: string
): Promise<{ valid: boolean; keyRecord?: APIKeyRecord; error?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const apiKey = authHeader.replace("Bearer ", "");
  
  if (!apiKey.startsWith("ghost_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  // Hash the key to compare
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // Look up key in database
  const { data: keyRecord, error } = await supabase
    .from("ghost_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyRecord) {
    return { valid: false, error: "Invalid API key" };
  }

  const record = keyRecord as APIKeyRecord;

  // Check if active
  if (!record.is_active) {
    return { valid: false, error: "API key has been revoked" };
  }

  // Check expiration
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  return { valid: true, keyRecord: record };
}

function checkRateLimit(keyId: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  let record = rateLimitMap.get(keyId);
  
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(keyId, record);
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

async function handleCompletions(
  keyRecord: APIKeyRecord,
  body: any
): Promise<Response> {
  if (!keyRecord.permissions.includes("text")) {
    return new Response(JSON.stringify({ error: "API key does not have text permission" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Forward to ghost-inference
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-inference`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        ...body,
        api_key_id: keyRecord.id,
        user_id: keyRecord.user_id,
      }),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleImages(
  keyRecord: APIKeyRecord,
  body: any
): Promise<Response> {
  if (!keyRecord.permissions.includes("image")) {
    return new Response(JSON.stringify({ error: "API key does not have image permission" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Forward to ghost-image-gen
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-image-gen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        ...body,
        api_key_id: keyRecord.id,
        user_id: keyRecord.user_id,
      }),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleVideos(
  keyRecord: APIKeyRecord,
  body: any
): Promise<Response> {
  if (!keyRecord.permissions.includes("video")) {
    return new Response(JSON.stringify({ error: "API key does not have video permission" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Forward to ghost-video-gen
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-video-gen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        ...body,
        api_key_id: keyRecord.id,
        user_id: keyRecord.user_id,
      }),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleJobStatus(
  keyRecord: APIKeyRecord,
  jobId: string
): Promise<Response> {
  // Forward status check to ghost-video-gen
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-video-gen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        action: "status",
        taskId: jobId,
        user_id: keyRecord.user_id,
      }),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify({
    job_id: jobId,
    status: data.status,
    video_url: data.videoUrl,
  }), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleUsage(
  supabase: any,
  keyRecord: APIKeyRecord
): Promise<Response> {
  // Get usage stats
  const { data: usageData, error } = await supabase
    .from("ghost_usage")
    .select("modality, input_tokens, output_tokens, credits_used")
    .eq("user_id", keyRecord.user_id);

  if (error) {
    console.error("Failed to fetch usage:", error);
  }

  // Get credits
  const { data: creditsData } = await supabase
    .from("ghost_credits")
    .select("balance, paid_credits_balance, free_credits_remaining")
    .eq("user_id", keyRecord.user_id)
    .single();

  const breakdown = { text: 0, image: 0, video: 0 };
  let totalCredits = 0;

  if (usageData) {
    for (const row of usageData as any[]) {
      const credits = row.credits_used || 0;
      totalCredits += credits;
      if (row.modality === "text") breakdown.text += credits;
      else if (row.modality === "image") breakdown.image += credits;
      else if (row.modality === "video") breakdown.video += credits;
    }
  }

  const credits = creditsData as any;
  const creditsRemaining = credits
    ? (credits.paid_credits_balance || 0) + (credits.free_credits_remaining || 0)
    : 0;

  return new Response(JSON.stringify({
    total_requests: keyRecord.total_requests,
    credits_used: totalCredits,
    credits_remaining: creditsRemaining,
    breakdown,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Validate API key
    const authHeader = req.headers.get("Authorization") || "";
    const validation = await validateAPIKey(supabase, authHeader);

    if (!validation.valid || !validation.keyRecord) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyRecord = validation.keyRecord;

    // Check rate limit
    const rateLimit = checkRateLimit(keyRecord.id, keyRecord.rate_limit_per_minute);
    
    const rateLimitHeaders = {
      "X-RateLimit-Limit": keyRecord.rate_limit_per_minute.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": Math.floor(rateLimit.resetAt / 1000).toString(),
    };

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last used
    await supabase
      .from("ghost_api_keys")
      .update({ 
        last_used_at: new Date().toISOString(),
        total_requests: keyRecord.total_requests + 1,
      })
      .eq("id", keyRecord.id);

    // Parse path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];

    // Route request
    let response: Response;

    if (req.method === "POST") {
      const body = await req.json();

      if (endpoint === "completions") {
        response = await handleCompletions(keyRecord, body);
      } else if (endpoint === "images") {
        response = await handleImages(keyRecord, body);
      } else if (endpoint === "videos") {
        response = await handleVideos(keyRecord, body);
      } else {
        response = new Response(JSON.stringify({ error: "Unknown endpoint" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (req.method === "GET") {
      if (endpoint === "usage") {
        response = await handleUsage(supabase, keyRecord);
      } else if (pathParts.includes("jobs") && pathParts.length > pathParts.indexOf("jobs") + 1) {
        const jobId = pathParts[pathParts.indexOf("jobs") + 1];
        response = await handleJobStatus(keyRecord, jobId);
      } else {
        response = new Response(JSON.stringify({ error: "Unknown endpoint" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      response = new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add rate limit headers to response
    const responseHeaders = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Ghost API] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
