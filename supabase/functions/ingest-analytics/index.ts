// supabase/functions/ingest-analytics/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

interface AnalyticsEvent {
  event_type: string;
  event_name?: string;
  page_path?: string;
  feature_category?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  anonymous_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  user_agent?: string;
}

interface SessionUpdate {
  session_id: string;
  action: 'start' | 'heartbeat' | 'end';
  entry_page?: string;
  exit_page?: string;
  anonymous_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  device_type?: string;
  browser?: string;
  os?: string;
}

interface IngestRequest {
  type: 'event' | 'events' | 'session' | 'signup_complete' | 'user_login';
  event?: AnalyticsEvent;
  events?: AnalyticsEvent[];
  session?: SessionUpdate;
  signup_data?: Record<string, unknown>;
  session_id?: string;
  is_new_user?: boolean;
}

// Simple IP geolocation using ip-api.com (free tier)
async function getGeoLocation(ip: string): Promise<{ country_code?: string; region?: string; city?: string }> {
  try {
    // Skip private IPs
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip === '::1') {
      return {};
    }
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,regionName,city`, {
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    
    if (!response.ok) return {};
    
    const data = await response.json();
    return {
      country_code: data.countryCode,
      region: data.regionName,
      city: data.city
    };
  } catch {
    return {};
  }
}

// Parse user agent for device info
function parseUserAgent(ua?: string): { device_type: string; browser: string; os: string } {
  if (!ua) return { device_type: 'unknown', browser: 'unknown', os: 'unknown' };
  
  // Device type
  let device_type = 'desktop';
  if (/mobile/i.test(ua)) device_type = 'mobile';
  else if (/tablet|ipad/i.test(ua)) device_type = 'tablet';
  
  // Browser
  let browser = 'unknown';
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';
  
  // OS
  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  
  return { device_type, browser, os };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from auth if available
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    // Get IP address
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || null;
    
    // Get user agent
    const userAgent = req.headers.get('user-agent') || undefined;
    const deviceInfo = parseUserAgent(userAgent);

    const body: IngestRequest = await req.json();

    switch (body.type) {
      case 'event': {
        if (!body.event) {
          return new Response(
            JSON.stringify({ error: 'Missing event data' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const geo = ip ? await getGeoLocation(ip) : {};
        
        const { error } = await serviceClient.from('platform_analytics_events').insert({
          user_id: userId,
          anonymous_id: body.event.anonymous_id,
          session_id: body.event.session_id,
          event_type: body.event.event_type,
          event_name: body.event.event_name,
          page_path: body.event.page_path,
          feature_category: body.event.feature_category,
          metadata: body.event.metadata || {},
          ip_address: ip,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          user_agent: userAgent,
          referrer: body.event.referrer,
          utm_source: body.event.utm_source,
          utm_medium: body.event.utm_medium,
          utm_campaign: body.event.utm_campaign
        });

        if (error) throw error;
        break;
      }

      case 'events': {
        if (!body.events?.length) {
          return new Response(
            JSON.stringify({ error: 'Missing events data' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const geo = ip ? await getGeoLocation(ip) : {};
        
        const eventsToInsert = body.events.map(event => ({
          user_id: userId,
          anonymous_id: event.anonymous_id,
          session_id: event.session_id,
          event_type: event.event_type,
          event_name: event.event_name,
          page_path: event.page_path,
          feature_category: event.feature_category,
          metadata: event.metadata || {},
          ip_address: ip,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          user_agent: userAgent,
          referrer: event.referrer,
          utm_source: event.utm_source,
          utm_medium: event.utm_medium,
          utm_campaign: event.utm_campaign
        }));

        const { error } = await serviceClient.from('platform_analytics_events').insert(eventsToInsert);
        if (error) throw error;
        break;
      }

      case 'session': {
        if (!body.session) {
          return new Response(
            JSON.stringify({ error: 'Missing session data' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const geo = ip ? await getGeoLocation(ip) : {};
        const session = body.session;

        if (session.action === 'start') {
          const { error } = await serviceClient.from('user_sessions').insert({
            id: session.session_id,
            user_id: userId,
            anonymous_id: session.anonymous_id,
            entry_page: session.entry_page,
            ip_address: ip,
            country_code: geo.country_code,
            region: geo.region,
            city: geo.city,
            device_type: session.device_type || deviceInfo.device_type,
            browser: session.browser || deviceInfo.browser,
            os: session.os || deviceInfo.os,
            referrer: session.referrer,
            utm_source: session.utm_source,
            utm_medium: session.utm_medium,
            utm_campaign: session.utm_campaign,
            is_active: true
          });
          if (error) throw error;
        } else if (session.action === 'heartbeat') {
          const { error } = await serviceClient.from('user_sessions')
            .update({
              last_activity_at: new Date().toISOString(),
              exit_page: session.exit_page,
              user_id: userId || undefined // Update user_id if user logs in during session
            })
            .eq('id', session.session_id);
          if (error) throw error;
        } else if (session.action === 'end') {
          // Calculate duration and finalize session
          const { data: sessionData } = await serviceClient
            .from('user_sessions')
            .select('started_at')
            .eq('id', session.session_id)
            .single();

          if (sessionData) {
            const startedAt = new Date(sessionData.started_at);
            const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000);

            // Count events for this session
            const { count: eventCount } = await serviceClient
              .from('platform_analytics_events')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.session_id);

            const { count: pageCount } = await serviceClient
              .from('platform_analytics_events')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.session_id)
              .eq('event_type', 'page_view');

            const { count: featureCount } = await serviceClient
              .from('platform_analytics_events')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.session_id)
              .eq('event_type', 'feature_use');

            await serviceClient.from('user_sessions')
              .update({
                ended_at: new Date().toISOString(),
                duration_seconds: duration,
                exit_page: session.exit_page,
                is_active: false,
                event_count: eventCount || 0,
                page_count: pageCount || 0,
                feature_count: featureCount || 0
              })
              .eq('id', session.session_id);
          }
        }
        break;
      }

      case 'signup_complete': {
        // Called after signup to enrich signup data and trigger notification
        // Skip gracefully if not authenticated (race condition during login)
        if (!userId) {
          console.log('signup_complete: No user authenticated, skipping');
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'no_user' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (!body.signup_data) {
          console.log('signup_complete: No signup data provided, skipping');
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'no_data' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const geo = ip ? await getGeoLocation(ip) : {};
        const data = body.signup_data;

        // Update signup record with enriched data
        const { error: updateError } = await serviceClient
          .from('user_signups')
          .update({
            ip_address: ip,
            country_code: geo.country_code,
            region: geo.region,
            city: geo.city,
            referrer: data.referrer as string,
            utm_source: data.utm_source as string,
            utm_medium: data.utm_medium as string,
            utm_campaign: data.utm_campaign as string,
            landing_page: data.landing_page as string,
            pages_before_signup: data.pages_before_signup as number || 0,
            time_to_signup_seconds: data.time_to_signup_seconds as number || 0,
            device_type: deviceInfo.device_type,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            user_agent: userAgent
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Failed to update signup:', updateError);
        }

        // Get full signup data for notification
        const { data: signupData } = await serviceClient
          .from('user_signups')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (signupData && !signupData.notification_sent) {
          // Call notify-signup function
          try {
            const notifyResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-signup`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                },
                body: JSON.stringify({
                  user_id: userId,
                  email: signupData.email,
                  full_name: signupData.full_name,
                  signup_method: signupData.signup_method,
                  ip_address: ip,
                  country_code: geo.country_code,
                  city: geo.city,
                  referrer: signupData.referrer,
                  utm_source: signupData.utm_source,
                  utm_campaign: signupData.utm_campaign,
                  device_type: deviceInfo.device_type,
                  browser: deviceInfo.browser,
                  os: deviceInfo.os,
                  landing_page: signupData.landing_page,
                  tier_assigned: signupData.tier_assigned
                })
              }
            );
            
            if (!notifyResponse.ok) {
              console.error('notify-signup failed:', await notifyResponse.text());
            }
          } catch (notifyError) {
            console.error('Failed to call notify-signup:', notifyError);
          }
        }

        // Link anonymous session to user if exists
        if (data.session_id) {
          await serviceClient
            .from('user_sessions')
            .update({ user_id: userId, is_converted: true })
            .eq('id', data.session_id as string);
        }
        break;
      }

      case 'user_login': {
        // Track existing user login and link session to user
        if (!userId) {
          console.log('user_login: No user authenticated, skipping');
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'no_user' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Link session to user
        if (body.session_id) {
          await serviceClient
            .from('user_sessions')
            .update({ user_id: userId })
            .eq('id', body.session_id);
        }

        // Track login event
        const geo = ip ? await getGeoLocation(ip) : {};
        await serviceClient.from('platform_analytics_events').insert({
          user_id: userId,
          session_id: body.session_id,
          event_type: 'user_login',
          event_name: 'existing_user_login',
          ip_address: ip,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          user_agent: userAgent,
          metadata: { is_new_user: body.is_new_user ?? false }
        });

        console.log('user_login: Tracked login for user', userId);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown type: ${body.type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("ingest-analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
