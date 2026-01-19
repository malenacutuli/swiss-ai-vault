// supabase/functions/calendar-action/index.ts
// Calendar Actions for Manus Parity - create_event, list_events, update_event via Google Calendar API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Google Calendar API endpoints
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Action types
type CalendarActionType =
  | 'create_event'
  | 'list_events'
  | 'get_event'
  | 'update_event'
  | 'delete_event'
  | 'list_calendars'
  | 'quick_add'
  | 'find_free_time';

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime or date
  end: string;   // ISO datetime or date
  all_day?: boolean;
  attendees?: string[];
  reminders?: { method: 'email' | 'popup'; minutes: number }[];
  recurrence?: string[]; // RRULE format
  timezone?: string;
}

interface CalendarActionRequest {
  action: CalendarActionType;
  // Calendar selection
  calendar_id?: string; // defaults to 'primary'
  // Event params
  event?: CalendarEvent;
  event_id?: string;
  // List params
  time_min?: string; // ISO datetime
  time_max?: string;
  max_results?: number;
  query?: string;
  // Quick add
  text?: string;
  // Free/busy
  attendees?: string[];
  duration_minutes?: number;
  // Agent execution context
  run_id?: string;
  step_id?: string;
}

interface CalendarActionResponse {
  success: boolean;
  action: CalendarActionType;
  data?: any;
  error?: string;
}

// Decrypt stored credentials (same as gmail-oauth)
async function decryptCredentials(encrypted: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(GOOGLE_CLIENT_SECRET.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

// Get user's Google Calendar token (shared with Gmail)
async function getCalendarToken(supabase: any, userId: string): Promise<string | null> {
  // First try calendar-specific integration
  let { data } = await supabase
    .from('chat_integrations')
    .select('encrypted_access_token')
    .eq('user_id', userId)
    .eq('integration_type', 'google_calendar')
    .eq('is_active', true)
    .single();

  // Fall back to gmail integration (often has calendar scope)
  if (!data?.encrypted_access_token) {
    const gmailData = await supabase
      .from('chat_integrations')
      .select('encrypted_access_token')
      .eq('user_id', userId)
      .eq('integration_type', 'gmail')
      .eq('is_active', true)
      .single();

    data = gmailData.data;
  }

  if (!data?.encrypted_access_token) {
    console.error('[calendar-action] No Google token found');
    return null;
  }

  try {
    return await decryptCredentials(data.encrypted_access_token);
  } catch (e) {
    console.error('[calendar-action] Failed to decrypt token:', e);
    return null;
  }
}

// Execute Calendar API call
async function calendarApiCall(
  token: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${CALENDAR_API}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[calendar-action] Calendar API error: ${response.status}`, errorText);
    throw new Error(`Calendar API error: ${response.status}`);
  }

  // DELETE returns no content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// Format event for API
function formatEventForApi(event: CalendarEvent): any {
  const result: any = {
    summary: event.summary,
    description: event.description,
    location: event.location,
  };

  // Handle all-day vs timed events
  if (event.all_day) {
    result.start = { date: event.start.split('T')[0] };
    result.end = { date: event.end.split('T')[0] };
  } else {
    result.start = {
      dateTime: event.start,
      timeZone: event.timezone || 'UTC',
    };
    result.end = {
      dateTime: event.end,
      timeZone: event.timezone || 'UTC',
    };
  }

  // Add attendees
  if (event.attendees?.length) {
    result.attendees = event.attendees.map(email => ({ email }));
  }

  // Add reminders
  if (event.reminders?.length) {
    result.reminders = {
      useDefault: false,
      overrides: event.reminders.map(r => ({
        method: r.method,
        minutes: r.minutes,
      })),
    };
  }

  // Add recurrence
  if (event.recurrence?.length) {
    result.recurrence = event.recurrence;
  }

  return result;
}

// Parse event from API
function parseEvent(event: any): any {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    all_day: !event.start?.dateTime,
    status: event.status,
    creator: event.creator?.email,
    organizer: event.organizer?.email,
    attendees: event.attendees?.map((a: any) => ({
      email: a.email,
      response_status: a.responseStatus,
      optional: a.optional,
    })),
    html_link: event.htmlLink,
    hangout_link: event.hangoutLink,
    recurrence: event.recurrence,
    recurring_event_id: event.recurringEventId,
    created: event.created,
    updated: event.updated,
  };
}

// Action handlers
const actionHandlers: Record<CalendarActionType, (token: string, params: CalendarActionRequest) => Promise<any>> = {
  // Create an event
  async create_event(token, params) {
    if (!params.event) {
      throw new Error('event is required');
    }

    if (!params.event.summary || !params.event.start || !params.event.end) {
      throw new Error('event.summary, event.start, and event.end are required');
    }

    const calendarId = params.calendar_id || 'primary';
    const eventData = formatEventForApi(params.event);

    const result = await calendarApiCall(
      token,
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      eventData
    );

    return parseEvent(result);
  },

  // List events
  async list_events(token, params) {
    const calendarId = params.calendar_id || 'primary';
    const maxResults = params.max_results || 20;

    // Default to next 7 days
    const timeMin = params.time_min || new Date().toISOString();
    const timeMax = params.time_max || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let endpoint = `/calendars/${encodeURIComponent(calendarId)}/events`;
    endpoint += `?timeMin=${encodeURIComponent(timeMin)}`;
    endpoint += `&timeMax=${encodeURIComponent(timeMax)}`;
    endpoint += `&maxResults=${maxResults}`;
    endpoint += `&singleEvents=true`;
    endpoint += `&orderBy=startTime`;

    if (params.query) {
      endpoint += `&q=${encodeURIComponent(params.query)}`;
    }

    const result = await calendarApiCall(token, 'GET', endpoint);

    return {
      events: (result.items || []).map(parseEvent),
      time_min: timeMin,
      time_max: timeMax,
      next_page_token: result.nextPageToken,
    };
  },

  // Get a single event
  async get_event(token, params) {
    if (!params.event_id) {
      throw new Error('event_id is required');
    }

    const calendarId = params.calendar_id || 'primary';
    const result = await calendarApiCall(
      token,
      'GET',
      `/calendars/${encodeURIComponent(calendarId)}/events/${params.event_id}`
    );

    return parseEvent(result);
  },

  // Update an event
  async update_event(token, params) {
    if (!params.event_id || !params.event) {
      throw new Error('event_id and event are required');
    }

    const calendarId = params.calendar_id || 'primary';
    const eventData = formatEventForApi(params.event);

    const result = await calendarApiCall(
      token,
      'PATCH',
      `/calendars/${encodeURIComponent(calendarId)}/events/${params.event_id}?sendUpdates=all`,
      eventData
    );

    return parseEvent(result);
  },

  // Delete an event
  async delete_event(token, params) {
    if (!params.event_id) {
      throw new Error('event_id is required');
    }

    const calendarId = params.calendar_id || 'primary';
    await calendarApiCall(
      token,
      'DELETE',
      `/calendars/${encodeURIComponent(calendarId)}/events/${params.event_id}?sendUpdates=all`
    );

    return {
      deleted: true,
      event_id: params.event_id,
    };
  },

  // List calendars
  async list_calendars(token, _params) {
    const result = await calendarApiCall(token, 'GET', '/users/me/calendarList');

    return {
      calendars: (result.items || []).map((cal: any) => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary,
        access_role: cal.accessRole,
        background_color: cal.backgroundColor,
        foreground_color: cal.foregroundColor,
        time_zone: cal.timeZone,
      })),
    };
  },

  // Quick add (natural language)
  async quick_add(token, params) {
    if (!params.text) {
      throw new Error('text is required (e.g., "Meeting tomorrow at 3pm")');
    }

    const calendarId = params.calendar_id || 'primary';
    const result = await calendarApiCall(
      token,
      'POST',
      `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(params.text)}`
    );

    return parseEvent(result);
  },

  // Find free time slots
  async find_free_time(token, params) {
    const timeMin = params.time_min || new Date().toISOString();
    const timeMax = params.time_max || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const durationMinutes = params.duration_minutes || 60;

    // Get calendar ID
    const calendarId = params.calendar_id || 'primary';

    // Build free/busy query
    const items = [{ id: calendarId }];
    if (params.attendees?.length) {
      for (const email of params.attendees) {
        items.push({ id: email });
      }
    }

    const result = await calendarApiCall(token, 'POST', '/freeBusy', {
      timeMin,
      timeMax,
      items,
    });

    // Parse busy times
    const busyTimes: { start: string; end: string }[] = [];
    for (const calId of Object.keys(result.calendars || {})) {
      const cal = result.calendars[calId];
      if (cal.busy) {
        for (const busy of cal.busy) {
          busyTimes.push({ start: busy.start, end: busy.end });
        }
      }
    }

    // Sort busy times
    busyTimes.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Find free slots
    const freeSlots: { start: string; end: string; duration_minutes: number }[] = [];
    let currentTime = new Date(timeMin);
    const endTime = new Date(timeMax);

    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      // Check if there's a gap before this busy period
      if (busyStart > currentTime) {
        const gapMinutes = (busyStart.getTime() - currentTime.getTime()) / (1000 * 60);
        if (gapMinutes >= durationMinutes) {
          freeSlots.push({
            start: currentTime.toISOString(),
            end: busyStart.toISOString(),
            duration_minutes: gapMinutes,
          });
        }
      }

      // Move current time past this busy period
      if (busyEnd > currentTime) {
        currentTime = busyEnd;
      }
    }

    // Check for free time after last busy period
    if (currentTime < endTime) {
      const gapMinutes = (endTime.getTime() - currentTime.getTime()) / (1000 * 60);
      if (gapMinutes >= durationMinutes) {
        freeSlots.push({
          start: currentTime.toISOString(),
          end: endTime.toISOString(),
          duration_minutes: gapMinutes,
        });
      }
    }

    return {
      free_slots: freeSlots.slice(0, 10), // Return top 10 slots
      busy_times: busyTimes,
      time_range: { min: timeMin, max: timeMax },
      requested_duration_minutes: durationMinutes,
    };
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const params: CalendarActionRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calendar-action] User ${user.id} executing action: ${params.action}`);

    // Get user's Calendar token
    const calendarToken = await getCalendarToken(supabase, user.id);
    if (!calendarToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google Calendar not connected. Please connect Google in settings.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute action
    const handler = actionHandlers[params.action];
    if (!handler) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action: ${params.action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await handler(calendarToken, params);

    // Log action for agent tracking
    if (params.run_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: params.run_id,
        step_id: params.step_id,
        output_type: 'calendar_action',
        content: {
          action: params.action,
          result: {
            ...result,
            // Redact attendee emails for privacy
            events: result.events?.map((e: any) => ({
              ...e,
              attendees: e.attendees?.length ? `[${e.attendees.length} attendees]` : undefined,
            })),
          },
          executed_at: new Date().toISOString(),
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `calendar_${params.action}`,
      resource_type: 'integration',
      resource_id: 'google_calendar',
      metadata: {
        action: params.action,
        event_summary: params.event?.summary,
        success: true,
      },
    }).catch(() => {}); // Non-critical

    const response: CalendarActionResponse = {
      success: true,
      action: params.action,
      data: result,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[calendar-action] Error:', error);

    const response: CalendarActionResponse = {
      success: false,
      action: 'list_events',
      error: error.message || 'Action failed',
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
