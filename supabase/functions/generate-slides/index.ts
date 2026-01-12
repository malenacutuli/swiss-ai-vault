// supabase/functions/generate-slides/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { THEMES, generateSlidePrompt } from '../_shared/slides/templates.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SWISS_API_URL = Deno.env.get("SWISS_API_URL") || "https://api.swissbrain.ai";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { title, outline, theme = 'swiss', slide_count = 10, run_id } = body;

    if (!title || !outline) {
      throw new Error('Title and outline required');
    }

    // Step 1: Generate slide content using Gemini
    const prompt = generateSlidePrompt(title, outline, slide_count, theme);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const slidesJson = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!slidesJson) {
      throw new Error('Failed to generate slide content');
    }

    // Parse slides JSON
    let slides;
    try {
      // Remove markdown code blocks if present
      const cleanJson = slidesJson.replace(/```json\n?|\n?```/g, '').trim();
      slides = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Invalid slide content generated');
    }

    // Step 2: Generate PPTX using Swiss K8s
    const themeConfig = THEMES[theme as keyof typeof THEMES] || THEMES.swiss;

    const pptxResponse = await fetch(`${SWISS_API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: generatePptxCode(title, slides, themeConfig),
        timeout: 120,
        packages: ['python-pptx']
      })
    });

    const pptxResult = await pptxResponse.json();

    if (!pptxResult.success) {
      throw new Error(pptxResult.error || 'PPTX generation failed');
    }

    // Step 3: Store artifact
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pptx`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('artifacts')
      .upload(fileName, Buffer.from(pptxResult.output_files?.[0]?.content || '', 'base64'), {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from('artifacts')
      .getPublicUrl(fileName);

    return new Response(JSON.stringify({
      success: true,
      slides: slides.length,
      url: urlData.publicUrl,
      filename: fileName
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function generatePptxCode(title: string, slides: any[], theme: any): string {
  return `
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RgbColor
from pptx.enum.text import PP_ALIGN
import base64
import json

# Theme colors
PRIMARY = '${theme.primary.replace('#', '')}'
SECONDARY = '${theme.secondary.replace('#', '')}'
ACCENT = '${theme.accent.replace('#', '')}'

# Create presentation
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

slides_data = json.loads('''${JSON.stringify(slides)}''')

for slide_data in slides_data:
    layout = slide_data.get('layout', 'content')

    if layout == 'title':
        slide_layout = prs.slide_layouts[6]  # Blank
        slide = prs.slides.add_slide(slide_layout)

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(2.5), Inches(12.333), Inches(1.5))
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = slide_data.get('title', '')
        title_para.font.size = Pt(54)
        title_para.font.bold = True
        title_para.alignment = PP_ALIGN.CENTER

        # Subtitle
        if slide_data.get('subtitle'):
            sub_box = slide.shapes.add_textbox(Inches(0.5), Inches(4.2), Inches(12.333), Inches(1))
            sub_frame = sub_box.text_frame
            sub_para = sub_frame.paragraphs[0]
            sub_para.text = slide_data.get('subtitle', '')
            sub_para.font.size = Pt(24)
            sub_para.alignment = PP_ALIGN.CENTER

    elif layout == 'bullets':
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(12.333), Inches(1))
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = slide_data.get('title', '')
        title_para.font.size = Pt(36)
        title_para.font.bold = True

        # Bullets
        bullets = slide_data.get('bullets', [])
        content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(12.333), Inches(5))
        tf = content_box.text_frame

        for i, bullet in enumerate(bullets):
            if i == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()
            p.text = f"• {bullet}"
            p.font.size = Pt(24)
            p.space_after = Pt(12)

    else:  # content
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(12.333), Inches(1))
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = slide_data.get('title', '')
        title_para.font.size = Pt(36)
        title_para.font.bold = True

        # Content
        content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(12.333), Inches(5))
        tf = content_box.text_frame
        tf.paragraphs[0].text = slide_data.get('content', '')
        tf.paragraphs[0].font.size = Pt(20)

# Save
prs.save('/tmp/output.pptx')

# Read and encode
with open('/tmp/output.pptx', 'rb') as f:
    content = base64.b64encode(f.read()).decode()

print(json.dumps({"filename": "output.pptx", "content": content}))
`;
}
