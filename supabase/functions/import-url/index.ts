import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple readability extraction - removes boilerplate and extracts main content
function extractReadableContent(html: string, baseUrl: string): { title: string; content: string; description: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse HTML");

  // Get title
  const titleEl = doc.querySelector("title");
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const title = ogTitle || titleEl?.textContent?.trim() || "Untitled";

  // Get description
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content");
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute("content");
  const description = ogDesc || metaDesc || "";

  // Remove unwanted elements
  const selectorsToRemove = [
    "script", "style", "noscript", "iframe", "svg", "nav", "footer", 
    "header", "aside", "[role='navigation']", "[role='banner']", 
    "[role='contentinfo']", ".nav", ".navigation", ".menu", ".sidebar",
    ".footer", ".header", ".ad", ".ads", ".advertisement", ".social",
    ".share", ".comments", ".related", ".recommended"
  ];
  
  selectorsToRemove.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    for (let i = 0; i < elements.length; i++) {
      (elements[i] as Element).remove();
    }
  });

  // Try to find main content container
  const mainSelectors = [
    "article", "main", "[role='main']", ".post-content", ".article-content",
    ".entry-content", ".content", "#content", ".post", ".article"
  ];

  let mainContent: Element | null = null;
  for (const selector of mainSelectors) {
    mainContent = doc.querySelector(selector) as Element | null;
    if (mainContent) break;
  }

  // Fall back to body if no main content found
  const contentElement = mainContent || doc.querySelector("body");
  if (!contentElement) throw new Error("No content found");

  // Extract text with basic formatting
  const extractText = (element: Element): string => {
    let text = "";
    
    for (const node of element.childNodes) {
      if (node.nodeType === 3) { // Text node
        text += node.textContent;
      } else if (node.nodeType === 1) { // Element node
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        // Skip hidden elements
        if (el.getAttribute("hidden") !== null || 
            el.getAttribute("style")?.includes("display: none") ||
            el.getAttribute("aria-hidden") === "true") {
          continue;
        }
        
        // Add formatting based on tag
        switch (tagName) {
          case "h1":
            text += `\n\n# ${extractText(el)}\n\n`;
            break;
          case "h2":
            text += `\n\n## ${extractText(el)}\n\n`;
            break;
          case "h3":
            text += `\n\n### ${extractText(el)}\n\n`;
            break;
          case "h4":
          case "h5":
          case "h6":
            text += `\n\n#### ${extractText(el)}\n\n`;
            break;
          case "p":
            text += `\n\n${extractText(el)}\n\n`;
            break;
          case "br":
            text += "\n";
            break;
          case "li":
            text += `\n• ${extractText(el)}`;
            break;
          case "ul":
          case "ol":
            text += `\n${extractText(el)}\n`;
            break;
          case "blockquote":
            text += `\n> ${extractText(el).replace(/\n/g, "\n> ")}\n`;
            break;
          case "code":
            text += `\`${extractText(el)}\``;
            break;
          case "pre":
            text += `\n\`\`\`\n${extractText(el)}\n\`\`\`\n`;
            break;
          case "a":
            const href = el.getAttribute("href");
            if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
              text += `[${extractText(el)}](${href})`;
            } else {
              text += extractText(el);
            }
            break;
          case "strong":
          case "b":
            text += `**${extractText(el)}**`;
            break;
          case "em":
          case "i":
            text += `*${extractText(el)}*`;
            break;
          default:
            text += extractText(el);
        }
      }
    }
    
    return text;
  };

  let content = extractText(contentElement as Element);
  
  // Clean up extra whitespace
  content = content
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { title, content, description };
}

// Get filename from URL or content-disposition header
function getFilename(url: string, headers: Headers): string {
  // Try content-disposition header first
  const disposition = headers.get("content-disposition");
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) return match[1].replace(/['"]/g, "");
  }
  
  // Fall back to URL path
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split("/").pop() || "document";
  return filename.includes(".") ? filename : `${filename}.html`;
}

// Determine if content is a document that should be processed
function isDocumentType(contentType: string, filename: string): boolean {
  const docTypes = ["application/pdf", "application/msword", 
    "application/vnd.openxmlformats-officedocument", "text/plain"];
  const docExtensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".pptx"];
  
  return docTypes.some(t => contentType.includes(t)) ||
         docExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url, conversation_id } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[import-url] Fetching: ${url}`);

    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SwissVault/1.0; +https://swissvault.ai)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const filename = getFilename(url, response.headers);

    console.log(`[import-url] Content-Type: ${contentType}, Filename: ${filename}`);

    // If it's a document file, upload to storage and trigger processing
    if (isDocumentType(contentType, filename)) {
      const blob = await response.blob();
      const jobId = crypto.randomUUID();
      const storagePath = `${user.id}/${conversation_id || "global"}/${jobId}/${filename}`;

      // Create processing job
      await supabase.from("document_processing_jobs").insert({
        id: jobId,
        conversation_id: conversation_id || null,
        user_id: user.id,
        file_name: filename,
        file_size: blob.size,
        file_type: contentType.split(";")[0],
        handler: "url_import",
        storage_path: storagePath,
        status: "uploading",
      });

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, blob, { contentType: blob.type });

      if (uploadError) {
        await supabase.from("document_processing_jobs")
          .update({ status: "failed", error_message: uploadError.message })
          .eq("id", jobId);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Update job status and trigger processing
      await supabase.from("document_processing_jobs")
        .update({ status: "queued", progress: 30 })
        .eq("id", jobId);

      // Trigger async processing via embed-document (fire and forget)
      fetch(`${supabaseUrl}/functions/v1/embed-document`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId, storage_path: storagePath, conversation_id }),
      }).catch(err => console.error("[import-url] Failed to trigger embed-document:", err));

      return new Response(
        JSON.stringify({
          success: true,
          type: "document",
          job_id: jobId,
          filename,
          file_size: blob.size,
          message: "Document queued for processing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For HTML pages, extract readable content
    if (contentType.includes("text/html")) {
      const html = await response.text();
      const { title, content, description } = extractReadableContent(html, url);

      if (!content || content.length < 50) {
        return new Response(
          JSON.stringify({ error: "Could not extract meaningful content from page" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[import-url] Extracted ${content.length} chars from: ${title}`);

      return new Response(
        JSON.stringify({
          success: true,
          type: "webpage",
          title,
          description,
          content,
          source_url: url,
          char_count: content.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For plain text, return directly
    if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
      const content = await response.text();
      
      return new Response(
        JSON.stringify({
          success: true,
          type: "text",
          title: filename,
          content,
          source_url: url,
          char_count: content.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unsupported content type
    return new Response(
      JSON.stringify({ error: `Unsupported content type: ${contentType}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[import-url] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
