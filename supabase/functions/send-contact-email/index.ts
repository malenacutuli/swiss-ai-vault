import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors, corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface ContactEmailRequest {
  type: "early_access" | "demo_request";
  name: string;
  email: string;
  company?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { type, name, email, company, message }: ContactEmailRequest = await req.json();

    console.log(`Processing ${type} request from ${email}`);

    const subject = type === "early_access" 
      ? `Early Access Request from ${name}`
      : `Demo Request from ${name}`;

    const htmlContent = type === "early_access" 
      ? `
        <h2>New Early Access Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        <p><strong>Type:</strong> Early Access Sign-up</p>
      `
      : `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p><strong>Type:</strong> Schedule Demo</p>
      `;

    // Send email to malena@axessible.ai using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SwissVault.ai <onboarding@resend.dev>",
        to: ["malena@axessible.ai"],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    console.log("Email sent successfully to malena@axessible.ai");

    // Send confirmation email to user
    const confirmationHtml = type === "early_access"
      ? `
        <h1>Thank you for your interest, ${name}!</h1>
        <p>We've received your early access request for SwissVault.ai.</p>
        <p>We're currently onboarding users in batches and will reach out soon with your access credentials.</p>
        <p>In the meantime, feel free to explore our API documentation.</p>
        <br>
        <p>Best regards,<br>The SwissVault.ai Team</p>
      `
      : `
        <h1>Thank you for your demo request, ${name}!</h1>
        <p>We've received your request to schedule a demo of SwissVault.ai.</p>
        <p>A member of our team will reach out within 24-48 hours to schedule a time that works for you.</p>
        <br>
        <p>Best regards,<br>The SwissVault.ai Team</p>
      `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SwissVault.ai <onboarding@resend.dev>",
        to: [email],
        subject: type === "early_access" 
          ? "Welcome to SwissVault.ai Early Access!" 
          : "Demo Request Received - SwissVault.ai",
        html: confirmationHtml,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
