// supabase/functions/_shared/audit/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  status?: 'success' | 'failure' | 'pending';
  errorMessage?: string;
}

export async function logAuditEvent(event: AuditEvent): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action: event.action,
      p_resource_type: event.resourceType,
      p_resource_id: event.resourceId || null,
      p_details: event.details || {},
      p_user_id: event.userId || null,
      p_org_id: event.organizationId || null,
      p_ip_address: event.ipAddress || null,
      p_user_agent: event.userAgent || null,
      p_request_id: event.requestId || null,
      p_status: event.status || 'success',
      p_error_message: event.errorMessage || null
    });

    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }

    return data;
  } catch (e) {
    console.error('Audit logging error:', e);
    return null;
  }
}

// Helper to extract request metadata
export function extractRequestMeta(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  return {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
    requestId: req.headers.get('x-request-id') || crypto.randomUUID()
  };
}

// Predefined audit actions
export const AuditActions = {
  // Auth
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  // Org
  ORG_CREATED: 'org.created',
  ORG_UPDATED: 'org.updated',
  MEMBER_ADDED: 'org.member_added',
  MEMBER_REMOVED: 'org.member_removed',
  ROLE_CHANGED: 'org.role_changed',
  // Data
  DATA_VIEWED: 'data.viewed',
  DATA_EXPORTED: 'data.exported',
  DATA_DELETED: 'data.deleted',
  DATA_SHARED: 'data.shared',
  // Tasks
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_CANCELLED: 'task.cancelled',
  // Integrations
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_DISCONNECTED: 'integration.disconnected'
};
