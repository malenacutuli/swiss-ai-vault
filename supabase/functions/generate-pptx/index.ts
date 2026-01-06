import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SlideContent {
  title: string;
  content: string[];
  notes?: string;
  layout?: 'title' | 'content' | 'two-column' | 'image';
}

interface PPTXRequest {
  title: string;
  slides: SlideContent[];
  theme?: 'default' | 'dark' | 'swiss' | 'corporate';
  taskId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PPTXRequest = await req.json();
    const { title, slides, theme = 'default', taskId } = body;

    if (!slides || slides.length === 0) {
      return new Response(
        JSON.stringify({ error: "No slides provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-pptx] Creating presentation: "${title}" with ${slides.length} slides for user ${user.id}`);

    // Try Modal first
    const modalUrl = Deno.env.get("MODAL_PPTX_ENDPOINT") || 
                     Deno.env.get("MODAL_DOCUMENT_GEN_ENDPOINT") ||
                     Deno.env.get("MODAL_ENDPOINT");

    let fileBuffer: Uint8Array;
    let filename: string;
    let contentType: string;

    if (modalUrl) {
      // Use Modal for high-quality generation
      console.log("[generate-pptx] Using Modal for generation");
      
      try {
        const modalResponse = await fetch(modalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pptx",
            title,
            slides,
            theme,
          }),
        });

        if (modalResponse.ok) {
          const arrayBuffer = await modalResponse.arrayBuffer();
          fileBuffer = new Uint8Array(arrayBuffer);
          filename = `presentation-${Date.now()}.pptx`;
          contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        } else {
          console.warn("[generate-pptx] Modal failed, using fallback");
          const fallback = generateJSONFallback(title, slides, theme);
          fileBuffer = fallback.buffer;
          filename = fallback.filename;
          contentType = "application/json";
        }
      } catch (modalError) {
        console.error("[generate-pptx] Modal error:", modalError);
        const fallback = generateJSONFallback(title, slides, theme);
        fileBuffer = fallback.buffer;
        filename = fallback.filename;
        contentType = "application/json";
      }
    } else {
      // Use fallback generation
      console.log("[generate-pptx] Modal not configured, using JSON fallback");
      const fallback = generateJSONFallback(title, slides, theme);
      fileBuffer = fallback.buffer;
      filename = fallback.filename;
      contentType = "application/json";
    }

    // Upload to storage
    const filePath = `${user.id}/presentations/${filename}`;
    
    const { error: uploadError } = await supabase.storage
      .from("agent-outputs")
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-pptx] Upload error:", uploadError);
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("agent-outputs")
      .getPublicUrl(filePath);

    // Save output record if taskId provided
    if (taskId) {
      await supabase.from("agent_outputs").insert({
        task_id: taskId,
        user_id: user.id,
        output_type: "pptx",
        file_name: filename,
        file_path: filePath,
        download_url: urlData.publicUrl,
        storage_bucket: "agent-outputs",
        mime_type: contentType,
      });
    }

    console.log(`[generate-pptx] Successfully created ${filename}`);

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        url: urlData.publicUrl,
        path: filePath,
        slideCount: slides.length,
        usedModal: !!modalUrl && contentType.includes("presentation"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-pptx] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback: Generate JSON structure for client-side processing
function generateJSONFallback(
  title: string,
  slides: SlideContent[],
  theme: string
): { buffer: Uint8Array; filename: string } {
  const themeColors: Record<string, { bg: string; text: string; accent: string }> = {
    default: { bg: '#FFFFFF', text: '#000000', accent: '#0D9488' },
    dark: { bg: '#1F2937', text: '#FFFFFF', accent: '#10B981' },
    swiss: { bg: '#FFFFFF', text: '#1F2937', accent: '#DC2626' },
    corporate: { bg: '#FFFFFF', text: '#1E3A5F', accent: '#2563EB' },
  };
  
  const colors = themeColors[theme] || themeColors.default;

  const pptxData = {
    _format: "pptx-json",
    _version: "1.0",
    title,
    theme,
    colors,
    slides: slides.map((slide, index) => ({
      number: index + 1,
      title: slide.title,
      content: slide.content,
      notes: slide.notes || null,
      layout: slide.layout || 'content',
    })),
    createdAt: new Date().toISOString(),
    message: "PPTX binary generation requires Modal. Use this JSON with a client-side library like pptxgenjs.",
  };

  const encoder = new TextEncoder();
  const buffer = encoder.encode(JSON.stringify(pptxData, null, 2));

  return {
    buffer,
    filename: `presentation-${Date.now()}.json`,
  };
}
