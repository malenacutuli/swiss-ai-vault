import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InfographicRequest {
  action: 'analyze' | 'generate' | 'get';
  artifactId?: string;
  sourceIds?: string[];
  notebookId?: string;
  options?: {
    layoutType: 'comparison' | 'timeline' | 'process' | 'statistics' | 'hierarchy' | 'auto';
    orientation: 'portrait' | 'landscape' | 'square';
    detailLevel: 'concise' | 'standard' | 'detailed';
    colorPrimary?: string;
    focusPrompt?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, artifactId, sourceIds, notebookId, options } = await req.json() as InfographicRequest;

    console.log(`[infographic-generator] Action: ${action}, User: ${userId}`);

    switch (action) {
      case 'analyze': {
        if (!sourceIds || sourceIds.length === 0) {
          throw new Error('No sources provided');
        }

        const { data: chunks } = await supabase
          .from('source_chunks')
          .select('content')
          .in('source_id', sourceIds)
          .order('chunk_index');

        const content = chunks?.map(c => c.content).join('\n\n') || '';
        
        const analysis = analyzeContentForLayout(content);

        return new Response(JSON.stringify({ 
          success: true, 
          analysis 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'generate': {
        if (!sourceIds || sourceIds.length === 0) {
          throw new Error('No sources provided');
        }

        const { data: chunks } = await supabase
          .from('source_chunks')
          .select('content')
          .in('source_id', sourceIds);

        const content = chunks?.map(c => c.content).join('\n\n') || '';

        // Generate infographic data
        const infographicData = generateInfographicData(
          content,
          options?.layoutType || 'statistics',
          options?.detailLevel || 'standard',
          options?.focusPrompt
        );

        // Get dimensions
        const dimensions = getDimensions(options?.orientation || 'portrait');
        const primaryColor = options?.colorPrimary || '#1D4E5F';
        
        // Create artifact
        const { data: artifact, error: artifactError } = await supabase
          .from('artifacts')
          .insert({
            user_id: userId,
            notebook_id: notebookId,
            artifact_type: 'infographic',
            title: infographicData.title,
            status: 'processing',
            orientation: options?.orientation || 'portrait',
            detail_level: options?.detailLevel || 'standard',
            generation_params: options
          })
          .select()
          .single();

        if (artifactError) {
          console.error('[infographic-generator] Error creating artifact:', artifactError);
          throw new Error('Failed to create artifact');
        }

        // Store layout data
        const { error: layoutError } = await supabase
          .from('infographic_layouts')
          .insert({
            artifact_id: artifact.id,
            layout_type: infographicData.layoutType,
            data_points: infographicData.dataPoints,
            color_primary: primaryColor,
            width: dimensions.width,
            height: dimensions.height
          });

        if (layoutError) {
          console.error('[infographic-generator] Error storing layout:', layoutError);
        }

        // Generate SVG
        const svg = generateInfographicSVG(infographicData, dimensions, primaryColor);

        // Update with SVG
        await supabase
          .from('infographic_layouts')
          .update({ svg_content: svg })
          .eq('artifact_id', artifact.id);

        await supabase
          .from('artifacts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', artifact.id);

        console.log(`[infographic-generator] Generated infographic: ${artifact.id}`);

        return new Response(JSON.stringify({ 
          success: true, 
          artifactId: artifact.id,
          svg,
          data: infographicData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get': {
        if (!artifactId) throw new Error('Missing artifactId');

        const { data: artifact } = await supabase
          .from('artifacts')
          .select('*, infographic_layouts(*)')
          .eq('id', artifactId)
          .single();

        return new Response(JSON.stringify({ 
          success: true, 
          artifact 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[infographic-generator] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getDimensions(orientation: string): { width: number; height: number } {
  switch (orientation) {
    case 'portrait': return { width: 1080, height: 1920 };
    case 'landscape': return { width: 1920, height: 1080 };
    case 'square': return { width: 1080, height: 1080 };
    default: return { width: 1080, height: 1920 };
  }
}

function analyzeContentForLayout(content: string): any {
  // Simple heuristic analysis
  const hasNumbers = /\d+%|\d+\s*(million|billion|thousand)/i.test(content);
  const hasComparison = /compared to|versus|vs\.|better than|worse than/i.test(content);
  const hasTimeline = /\d{4}|timeline|history|evolution|over time/i.test(content);
  const hasProcess = /step \d|first,|then,|finally,|process|workflow/i.test(content);
  
  let suggestedLayout = 'statistics';
  let reasoning = 'Default layout for general content';
  
  if (hasComparison) {
    suggestedLayout = 'comparison';
    reasoning = 'Content contains comparison language';
  } else if (hasTimeline) {
    suggestedLayout = 'timeline';
    reasoning = 'Content references dates or chronological events';
  } else if (hasProcess) {
    suggestedLayout = 'process';
    reasoning = 'Content describes step-by-step procedures';
  } else if (hasNumbers) {
    suggestedLayout = 'statistics';
    reasoning = 'Content is rich in numerical data';
  }

  // Extract key points
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyDataPoints = sentences.slice(0, 5).map(s => s.trim().substring(0, 100));

  return {
    suggestedLayout,
    reasoning,
    keyDataPoints,
    suggestedTitle: 'Key Insights'
  };
}

function generateInfographicData(
  content: string,
  layoutType: string,
  detailLevel: string,
  focusPrompt?: string
): any {
  const itemCount = detailLevel === 'concise' ? 3 : detailLevel === 'standard' ? 5 : 7;
  
  // Extract sentences with numbers or key phrases
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const prioritized = sentences
    .map(s => ({
      text: s.trim(),
      hasNumber: /\d/.test(s),
      length: s.length
    }))
    .sort((a, b) => (b.hasNumber ? 1 : 0) - (a.hasNumber ? 1 : 0))
    .slice(0, itemCount);

  const icons = ['chart', 'user', 'clock', 'star', 'target', 'lightbulb', 'shield', 'rocket'];
  
  const dataPoints = prioritized.map((item, index) => {
    const match = item.text.match(/(\d+(?:\.\d+)?%?|\d+(?:,\d{3})*)/);
    return {
      label: `Key Point ${index + 1}`,
      value: match ? match[0] : `#${index + 1}`,
      icon: icons[index % icons.length],
      description: item.text.substring(0, 80)
    };
  });

  return {
    title: focusPrompt || 'Key Insights',
    subtitle: 'Data-driven summary',
    layoutType: layoutType === 'auto' ? 'statistics' : layoutType,
    dataPoints
  };
}

function generateInfographicSVG(
  data: any, 
  dimensions: { width: number; height: number }, 
  primaryColor: string
): string {
  const { width, height } = dimensions;
  const dataPoints = data.dataPoints || [];
  
  let contentSVG = '';
  const itemHeight = Math.min(150, (height - 400) / Math.max(dataPoints.length, 1));
  
  dataPoints.forEach((point: any, index: number) => {
    const y = 300 + index * itemHeight;
    contentSVG += `
      <g transform="translate(80, ${y})">
        <circle cx="30" cy="30" r="30" fill="${primaryColor}" opacity="0.1"/>
        <text x="30" y="38" text-anchor="middle" font-size="24">${getIconChar(point.icon)}</text>
        <text x="80" y="25" fill="#1a1a1a" font-size="18" font-weight="600">${escapeXml(point.label)}</text>
        <text x="80" y="50" fill="${primaryColor}" font-size="24" font-weight="700">${escapeXml(point.value)}</text>
        <text x="80" y="75" fill="#666" font-size="12">${escapeXml((point.description || '').substring(0, 60))}</text>
      </g>
    `;
  });

  const secondaryColor = adjustColor(primaryColor, 20);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  
  <rect width="${width}" height="200" fill="url(#headerGradient)"/>
  <text x="${width/2}" y="100" text-anchor="middle" fill="white" font-size="32" font-weight="700" font-family="Inter, sans-serif">
    ${escapeXml(data.title || 'Infographic')}
  </text>
  <text x="${width/2}" y="145" text-anchor="middle" fill="white" opacity="0.9" font-size="16" font-family="Inter, sans-serif">
    ${escapeXml(data.subtitle || '')}
  </text>
  
  ${contentSVG}
  
  <rect y="${height - 60}" width="${width}" height="60" fill="${primaryColor}" opacity="0.05"/>
  <text x="${width/2}" y="${height - 25}" text-anchor="middle" fill="#666" font-size="11" font-family="Inter, sans-serif">
    Generated by SwissBrAIn Studio
  </text>
</svg>`;
}

function getIconChar(icon: string): string {
  const icons: Record<string, string> = {
    chart: '📊',
    user: '👤',
    clock: '⏱️',
    star: '⭐',
    target: '🎯',
    lightbulb: '💡',
    shield: '🛡️',
    rocket: '🚀'
  };
  return icons[icon] || '•';
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c] || c));
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
