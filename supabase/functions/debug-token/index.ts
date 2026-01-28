// Debug endpoint to see token contents
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  return atob(base64);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No token provided', authHeader }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid JWT format', parts: parts.length, tokenPreview: token.slice(0, 50) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    return new Response(
      JSON.stringify({
        success: true,
        header,
        payload,
        keys: Object.keys(payload),
        sub: payload.sub,
        user_id: payload.user_id,
        id: payload.id,
        email: payload.email,
        iss: payload.iss,
        role: payload.role,
        aud: payload.aud,
        exp: payload.exp,
        tokenLength: token.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
