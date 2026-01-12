// supabase/functions/generate-document/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createArtifact } from "../_shared/artifacts/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SWISS_API = "https://api.swissbrain.ai";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const {
      type,  // 'pptx' | 'docx' | 'xlsx'
      content,
      run_id,
      step_id,
      file_name
    } = await req.json();

    if (!type || !content || !run_id || !step_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, content, run_id, step_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route to appropriate generator
    let result;
    switch (type) {
      case 'pptx':
        result = await generatePptx(content, run_id, step_id);
        break;
      case 'docx':
        result = await generateDocx(content, run_id, step_id);
        break;
      case 'xlsx':
        result = await generateXlsx(content, run_id, step_id);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store as artifact
    const mimeTypes: Record<string, string> = {
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const defaultNames: Record<string, string> = {
      pptx: 'presentation.pptx',
      docx: 'document.docx',
      xlsx: 'spreadsheet.xlsx'
    };

    const artifactResult = await createArtifact(supabase, {
      content: result.data,
      type: 'document',
      mime_type: mimeTypes[type],
      file_name: file_name || defaultNames[type],
      run_id,
      step_id,
      tool_name: `generate_${type}`,
      metadata: {
        generator: 'swiss-k8s',
        content_summary: typeof content === 'string' ? content.slice(0, 200) : JSON.stringify(content).slice(0, 200)
      }
    });

    // Get download URL
    const { data: urlData } = await supabase.storage
      .from('artifacts')
      .createSignedUrl(artifactResult.artifact.storage_path, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        artifact_id: artifactResult.artifact.id,
        file_name: artifactResult.artifact.file_name,
        download_url: urlData?.signedUrl,
        is_duplicate: artifactResult.is_duplicate
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Document generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generatePptx(
  content: any,
  runId: string,
  stepId: string
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  const pythonCode = `
import json
import base64
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from io import BytesIO

content = json.loads('''${JSON.stringify(content)}''')

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

for slide_data in content.get('slides', []):
    slide_layout = prs.slide_layouts[6]  # Blank
    slide = prs.slides.add_slide(slide_layout)

    # Title
    if slide_data.get('title'):
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(12), Inches(1))
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = slide_data['title']
        title_para.font.size = Pt(44)
        title_para.font.bold = True

    # Content
    if slide_data.get('content'):
        content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(12), Inches(5))
        content_frame = content_box.text_frame
        content_frame.word_wrap = True

        for i, item in enumerate(slide_data['content'] if isinstance(slide_data['content'], list) else [slide_data['content']]):
            para = content_frame.paragraphs[0] if i == 0 else content_frame.add_paragraph()
            para.text = f"• {item}" if isinstance(slide_data['content'], list) else item
            para.font.size = Pt(24)
            para.space_after = Pt(12)

buffer = BytesIO()
prs.save(buffer)
buffer.seek(0)
print(base64.b64encode(buffer.read()).decode())
`;

  return await executeSwissPython(pythonCode, runId, stepId);
}

async function generateDocx(
  content: any,
  runId: string,
  stepId: string
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  const pythonCode = `
import json
import base64
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from io import BytesIO

content = json.loads('''${JSON.stringify(content)}''')

doc = Document()

# Title
if content.get('title'):
    title = doc.add_heading(content['title'], 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Sections
for section in content.get('sections', []):
    if section.get('heading'):
        doc.add_heading(section['heading'], level=section.get('level', 1))

    if section.get('content'):
        if isinstance(section['content'], list):
            for item in section['content']:
                doc.add_paragraph(item, style='List Bullet')
        else:
            doc.add_paragraph(section['content'])

# Tables
for table_data in content.get('tables', []):
    rows = table_data.get('rows', [])
    if rows:
        table = doc.add_table(rows=len(rows), cols=len(rows[0]))
        table.style = 'Table Grid'
        for i, row in enumerate(rows):
            for j, cell in enumerate(row):
                table.rows[i].cells[j].text = str(cell)

buffer = BytesIO()
doc.save(buffer)
buffer.seek(0)
print(base64.b64encode(buffer.read()).decode())
`;

  return await executeSwissPython(pythonCode, runId, stepId);
}

async function generateXlsx(
  content: any,
  runId: string,
  stepId: string
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  const pythonCode = `
import json
import base64
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from io import BytesIO

content = json.loads('''${JSON.stringify(content)}''')

wb = Workbook()

for sheet_idx, sheet_data in enumerate(content.get('sheets', [{'name': 'Sheet1', 'data': content.get('data', [])}])):
    if sheet_idx == 0:
        ws = wb.active
        ws.title = sheet_data.get('name', 'Sheet1')
    else:
        ws = wb.create_sheet(title=sheet_data.get('name', f'Sheet{sheet_idx + 1}'))

    data = sheet_data.get('data', [])

    for row_idx, row in enumerate(data, 1):
        for col_idx, value in enumerate(row, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)

            # Header styling (first row)
            if row_idx == 1:
                cell.font = Font(bold=True)
                cell.alignment = Alignment(horizontal='center')

    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column_letter].width = min(max_length + 2, 50)

buffer = BytesIO()
wb.save(buffer)
buffer.seek(0)
print(base64.b64encode(buffer.read()).decode())
`;

  return await executeSwissPython(pythonCode, runId, stepId);
}

async function executeSwissPython(
  code: string,
  runId: string,
  stepId: string
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  try {
    const response = await fetch(`${SWISS_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "python_execute",
        parameters: { code },
        run_id: runId,
        step_id: stepId,
        timeout_ms: 60000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Swiss API error: ${error}` };
    }

    const result = await response.json();

    if (result.error) {
      return { success: false, error: result.error };
    }

    // Decode base64 output
    const base64Output = result.output?.trim() || result.stdout?.trim();
    if (!base64Output) {
      return { success: false, error: "No output from Python execution" };
    }

    const binaryString = atob(base64Output);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return { success: true, data: bytes };

  } catch (error) {
    return { success: false, error: error.message };
  }
}
