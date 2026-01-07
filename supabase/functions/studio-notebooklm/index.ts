import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const PROJECT_ID = Deno.env.get("GOOGLE_CLOUD_PROJECT") || "swissvault";
const LOCATION = "europe-west6"; // Swiss region
const BASE_URL = `https://${LOCATION}-discoveryengine.googleapis.com/v1alpha`;

// Strict CORS allowlist
const ALLOWED_ORIGINS = [
  "https://swissvault.ai",
  "https://www.swissvault.ai",
  "https://app.swissvault.ai",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.some(o => origin.includes(o.replace(/https?:\/\//, '')));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

// Token cache for Google API
let tokenCache: { token: string; expiry: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && Date.now() < tokenCache.expiry - 60000) {
    return tokenCache.token;
  }

  const credJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!credJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const creds = JSON.parse(credJson);

  // Create JWT header
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(
    JSON.stringify({
      iss: creds.client_email,
      sub: creds.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signInput = `${header}.${payload}`;

  // Sign JWT with private key
  const keyData = Uint8Array.from(
    atob(
      creds.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "")
    ),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signInput}.${sigB64}`;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  // Cache the token
  tokenCache = {
    token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.token;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Verify JWT from Supabase
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, notebook_id, ...params } = body;

    console.log(`[studio-notebooklm] Action: ${action}, User: ${user.id}`);

    const token = await getAccessToken();
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;

    // Check quota for heavy operations
    const heavyOps = [
      "generate_podcast",
      "generate_audio_overview",
      "generate_slides",
      "generate_quiz",
      "generate_flashcards",
      "generate_mind_map",
      "generate_report",
      "generate_study_guide",
      "generate_faq",
      "generate_timeline",
    ];

    if (heavyOps.includes(action) && notebook_id) {
      const { data: quota } = await supabase.rpc("check_artifact_quota", {
        p_notebook_id: notebook_id,
        p_artifact_type: action.replace("generate_", ""),
      });

      if (quota && !quota.allowed) {
        return new Response(
          JSON.stringify({
            error: "Quota exceeded",
            ...quota,
            message: `Daily limit reached (${quota.current}/${quota.limit}). Resets at midnight UTC.`,
          }),
          {
            status: 429,
            headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }
    }

    // For heavy operations: create async job
    if (heavyOps.includes(action)) {
      const { data: job, error: jobErr } = await supabase
        .from("artifact_jobs")
        .insert({
          notebook_id,
          user_id: user.id,
          artifact_type: action.replace("generate_", ""),
          status: "pending",
          params,
        })
        .select()
        .single();

      if (jobErr) throw jobErr;

      // Increment quota
      await supabase.rpc("increment_quota", {
        p_notebook_id: notebook_id,
        p_artifact_type: action.replace("generate_", ""),
      });

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          status: "pending",
          message: "Generation queued. Poll for status updates.",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Handle synchronous operations
    switch (action) {
      case "create_notebook":
        // Create in database first
        const { data: newNotebook, error: createErr } = await supabase
          .from("studio_notebooks")
          .insert({
            user_id: user.id,
            title: params.title,
          })
          .select()
          .single();

        if (createErr) throw createErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: newNotebook,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "list_notebooks":
        const { data: notebooks, error: listErr } = await supabase
          .from("studio_notebooks")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (listErr) throw listErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: notebooks,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "get_notebook":
        const { data: notebook, error: getErr } = await supabase
          .from("studio_notebooks")
          .select("*, studio_sources(*)")
          .eq("id", notebook_id)
          .single();

        if (getErr) throw getErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: notebook,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "delete_notebook":
        const { error: deleteErr } = await supabase
          .from("studio_notebooks")
          .delete()
          .eq("id", notebook_id)
          .eq("user_id", user.id);

        if (deleteErr) throw deleteErr;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Notebook deleted",
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "add_source":
      case "add_sources":
        const sources = params.sources || [params.source];
        const insertedSources = [];

        for (const source of sources) {
          const { data: newSource, error: sourceErr } = await supabase
            .from("studio_sources")
            .insert({
              notebook_id,
              source_type: source.type || inferSourceType(source),
              title: source.title || source.url || source.file_name,
              source_url: source.url,
              storage_key: source.storage_key,
            })
            .select()
            .single();

          if (sourceErr) throw sourceErr;
          insertedSources.push(newSource);
        }

        // Update notebook updated_at
        await supabase
          .from("studio_notebooks")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", notebook_id);

        return new Response(
          JSON.stringify({
            success: true,
            data: insertedSources,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "remove_source":
        const { error: removeErr } = await supabase
          .from("studio_sources")
          .delete()
          .eq("id", params.source_id);

        if (removeErr) throw removeErr;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Source removed",
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "assist":
      case "chat":
        // Call Gemini for chat (simulated NotebookLM behavior)
        const chatResponse = await callGeminiChat(
          token,
          notebook_id,
          params.query,
          params.session_id,
          supabase
        );

        // Store message
        await supabase.from("studio_messages").insert({
          notebook_id,
          session_id: params.session_id || crypto.randomUUID(),
          role: "user",
          content: params.query,
        });

        await supabase.from("studio_messages").insert({
          notebook_id,
          session_id: params.session_id,
          role: "assistant",
          content: chatResponse.answer,
          evidence: chatResponse.evidence || [],
          grounding_metadata: chatResponse.groundingMetadata,
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: chatResponse,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      case "get_job_status":
        const { data: jobStatus, error: jobStatusErr } = await supabase
          .from("artifact_jobs")
          .select("*")
          .eq("id", params.job_id)
          .single();

        if (jobStatusErr) throw jobStatusErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: jobStatus,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("[studio-notebooklm] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to infer source type
function inferSourceType(source: any): string {
  if (source.url) {
    if (source.url.includes("youtube.com") || source.url.includes("youtu.be")) {
      return "youtube";
    }
    if (source.url.endsWith(".pdf")) return "pdf";
    return "web";
  }
  if (source.file_name) {
    const ext = source.file_name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx"].includes(ext || "")) return "doc";
    if (["xls", "xlsx", "csv"].includes(ext || "")) return "sheet";
    if (["ppt", "pptx"].includes(ext || "")) return "slide";
  }
  return "text";
}

// Call Gemini for grounded chat
async function callGeminiChat(
  token: string,
  notebookId: string,
  query: string,
  sessionId: string | undefined,
  supabase: any
): Promise<any> {
  // Get sources for context
  const { data: sources } = await supabase
    .from("studio_sources")
    .select("*")
    .eq("notebook_id", notebookId);

  // Get previous messages for context
  const { data: history } = await supabase
    .from("studio_messages")
    .select("role, content")
    .eq("notebook_id", notebookId)
    .eq("session_id", sessionId || "")
    .order("created_at", { ascending: true })
    .limit(10);

  // Build context from sources
  const sourceContext = sources
    ?.map((s: any) => `[${s.source_type.toUpperCase()}] ${s.title}: ${s.source_url || "uploaded file"}`)
    .join("\n");

  // Call Gemini API
  const geminiUrl = `https://europe-west6-aiplatform.googleapis.com/v1/projects/swissvault/locations/europe-west6/publishers/google/models/gemini-2.0-flash:generateContent`;

  const messages = [
    {
      role: "user",
      parts: [
        {
          text: `You are a research assistant analyzing these sources:\n\n${sourceContext}\n\nPrevious conversation:\n${
            history?.map((m: any) => `${m.role}: ${m.content}`).join("\n") || "None"
          }\n\nUser question: ${query}\n\nProvide a detailed answer with citations to the sources where applicable. Format citations as [Source: title].`,
        },
      ],
    },
  ];

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini API error");
  }

  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";

  // Extract evidence from citations in the answer
  const evidence = extractEvidence(answer, sources || []);

  return {
    answer,
    evidence,
    groundingMetadata: data.candidates?.[0]?.groundingMetadata,
  };
}

// Extract evidence objects from answer
function extractEvidence(answer: string, sources: any[]): any[] {
  const evidence: any[] = [];
  const citationRegex = /\[Source: ([^\]]+)\]/g;
  let match;

  while ((match = citationRegex.exec(answer)) !== null) {
    const sourceTitle = match[1];
    const source = sources.find(
      (s) => s.title?.toLowerCase().includes(sourceTitle.toLowerCase())
    );

    if (source) {
      evidence.push({
        evidence_id: crypto.randomUUID(),
        source_uri: source.source_url || source.storage_key,
        source_title: source.title,
        source_type: source.source_type,
        confidence: 0.85,
        snippet: match[0],
      });
    }
  }

  return evidence;
}
