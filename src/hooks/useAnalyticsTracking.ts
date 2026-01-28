// src/hooks/useAnalyticsTracking.ts
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/contexts/AnalyticsContext';

/**
 * Hook to automatically track page views on route changes
 */
export function usePageViewTracking() {
  const location = useLocation();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);
}

/**
 * Hook to track feature usage in a component
 */
export function useFeatureTracking(featureName: string, category: string) {
  const { trackFeatureUse } = useAnalytics();

  const track = (metadata?: Record<string, unknown>) => {
    trackFeatureUse(featureName, category, metadata);
  };

  return { track };
}

/**
 * Feature categories for consistent tracking
 */
export const FeatureCategory = {
  GHOST_CHAT: 'ghost',
  STUDIO: 'studio',
  AGENTS: 'agents',
  DISCOVERY: 'discovery',
  HEALTH: 'health',
  VAULT: 'vault',
  AUTH: 'auth',
  SETTINGS: 'settings',
  ADMIN: 'admin'
} as const;

/**
 * Common feature names
 */
export const FeatureName = {
  // Ghost Chat
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_MODEL_SWITCHED: 'chat_model_switched',
  CHAT_MODE_CHANGED: 'chat_mode_changed',
  CHAT_CONVERSATION_CREATED: 'chat_conversation_created',
  
  // Studio
  STUDIO_ARTIFACT_GENERATED: 'studio_artifact_generated',
  STUDIO_SOURCE_UPLOADED: 'studio_source_uploaded',
  STUDIO_NOTEBOOK_CREATED: 'studio_notebook_created',
  
  // Agents
  AGENT_TASK_STARTED: 'agent_task_started',
  AGENT_TASK_COMPLETED: 'agent_task_completed',
  AGENT_TASK_FAILED: 'agent_task_failed',
  
  // Discovery
  DISCOVERY_SEARCH: 'discovery_search',
  DISCOVERY_SOURCE_SELECTED: 'discovery_source_selected',
  
  // Health
  HEALTH_CONSULTATION_STARTED: 'health_consultation_started',
  HEALTH_DOCUMENT_UPLOADED: 'health_document_uploaded',
  
  // Vault
  VAULT_FILE_ENCRYPTED: 'vault_file_encrypted',
  VAULT_FILE_SHARED: 'vault_file_shared',
  
  // Auth
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_SIGNUP: 'auth_signup',
  
  // Admin
  ADMIN_DASHBOARD_VIEWED: 'admin_dashboard_viewed',
  ADMIN_USER_VIEWED: 'admin_user_viewed'
} as const;
