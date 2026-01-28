// supabase/functions/notify-signup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "malena@axessible.ai";

interface SignupNotification {
  user_id: string;
  email: string;
  full_name?: string;
  signup_method?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  referrer?: string;
  utm_source?: string;
  utm_campaign?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  landing_page?: string;
  tier_assigned?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const body: SignupNotification = await req.json();
    
    const {
      user_id,
      email,
      full_name,
      signup_method = 'email',
      ip_address,
      country_code,
      city,
      referrer,
      utm_source,
      utm_campaign,
      device_type,
      browser,
      os,
      landing_page,
      tier_assigned = 'ghost_free'
    } = body;

    const timestamp = new Date().toISOString();
    const dashboardUrl = `https://swissbrain.ai/admin/platform-analytics`;

    // Format location
    const location = [city, country_code].filter(Boolean).join(", ") || "Unknown";
    
    // Format device info
    const deviceInfo = [device_type, browser, os].filter(Boolean).join(" / ") || "Unknown";

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1D4E5F 0%, #2a6a7f 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .subtitle { opacity: 0.9; margin-top: 5px; }
    .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 16px; }
    .field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    .field-value { font-size: 16px; color: #111827; }
    .field-value a { color: #1D4E5F; text-decoration: none; }
    .section { border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 24px; }
    .section-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; }
    .cta { display: inline-block; background: #1D4E5F; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 20px; }
    .footer { margin-top: 24px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 New SwissBrain Signup</h1>
      <div class="subtitle">${timestamp}</div>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value"><a href="mailto:${email}">${email}</a></div>
      </div>
      
      ${full_name ? `
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-value">${full_name}</div>
      </div>
      ` : ''}
      
      <div class="field">
        <div class="field-label">User ID</div>
        <div class="field-value" style="font-family: monospace; font-size: 14px;">${user_id}</div>
      </div>
      
      <div class="grid">
        <div class="field">
          <div class="field-label">Signup Method</div>
          <div class="field-value">${signup_method}</div>
        </div>
        <div class="field">
          <div class="field-label">Tier</div>
          <div class="field-value"><span class="badge">${tier_assigned}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📍 Location & Device</div>
        <div class="grid">
          <div class="field">
            <div class="field-label">Location</div>
            <div class="field-value">${location}</div>
          </div>
          <div class="field">
            <div class="field-label">IP Address</div>
            <div class="field-value">${ip_address || 'Unknown'}</div>
          </div>
          <div class="field">
            <div class="field-label">Device</div>
            <div class="field-value">${deviceInfo}</div>
          </div>
        </div>
      </div>

      ${(referrer || utm_source || utm_campaign || landing_page) ? `
      <div class="section">
        <div class="section-title">🔗 Traffic Source</div>
        <div class="grid">
          ${referrer ? `
          <div class="field">
            <div class="field-label">Referrer</div>
            <div class="field-value">${referrer}</div>
          </div>
          ` : ''}
          ${utm_source ? `
          <div class="field">
            <div class="field-label">UTM Source</div>
            <div class="field-value">${utm_source}</div>
          </div>
          ` : ''}
          ${utm_campaign ? `
          <div class="field">
            <div class="field-label">UTM Campaign</div>
            <div class="field-value">${utm_campaign}</div>
          </div>
          ` : ''}
          ${landing_page ? `
          <div class="field">
            <div class="field-label">Landing Page</div>
            <div class="field-value">${landing_page}</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <a href="${dashboardUrl}" class="cta">View in Dashboard →</a>
    </div>
    <div class="footer">
      SwissBrain Platform Notifications<br>
      This is an automated message from your analytics system.
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "SwissBrain <notifications@swissbrain.ai>",
      to: [ADMIN_EMAIL],
      subject: `🆕 New Signup: ${email}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send notification", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update notification_sent flag in database
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from('user_signups')
      .update({ notification_sent: true })
      .eq('user_id', user_id);

    console.log(`Signup notification sent for ${email} to ${ADMIN_EMAIL}`);

    return new Response(
      JSON.stringify({ success: true, sent_to: ADMIN_EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("notify-signup error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
