// supabase/functions/_shared/tool-router/routes.ts

import { ToolRoute } from "./types.ts";

// ALL execution-heavy tools → Swiss K8s (NOT Modal)
export const TOOL_ROUTES: Record<string, ToolRoute> = {
  // Browser → Swiss K8s
  browser_navigate: { backend: 'k8s_swiss', timeout: 30000, credits: 1, retryable: true, maxRetries: 2 },
  browser_screenshot: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: true, maxRetries: 2 },
  browser_click: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: true, maxRetries: 2 },
  browser_type: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: true, maxRetries: 2 },

  // Shell → Swiss K8s
  shell_execute: { backend: 'k8s_swiss', timeout: 120000, credits: 2, retryable: false, maxRetries: 0 },
  shell_view: { backend: 'k8s_swiss', timeout: 5000, credits: 0.1, retryable: true, maxRetries: 3 },

  // File → Swiss K8s
  file_read: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: true, maxRetries: 2 },
  file_write: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: false, maxRetries: 0 },
  file_edit: { backend: 'k8s_swiss', timeout: 10000, credits: 0.5, retryable: false, maxRetries: 0 },

  // Search → Edge (Perplexity API)
  search_web: { backend: 'edge', timeout: 15000, credits: 1, retryable: true, maxRetries: 2 },
  search_images: { backend: 'edge', timeout: 15000, credits: 1, retryable: true, maxRetries: 2 },

  // Document → Swiss K8s
  generate_slides: { backend: 'k8s_swiss', timeout: 120000, credits: 5, retryable: false, maxRetries: 0 },
  generate_document: { backend: 'k8s_swiss', timeout: 60000, credits: 3, retryable: false, maxRetries: 0 },
  generate_spreadsheet: { backend: 'k8s_swiss', timeout: 60000, credits: 3, retryable: false, maxRetries: 0 },

  // Image → Edge (Google Imagen 3)
  generate_image: { backend: 'edge', timeout: 30000, credits: 5, retryable: true, maxRetries: 2 },

  // Communication → Edge
  send_message: { backend: 'edge', timeout: 5000, credits: 0, retryable: true, maxRetries: 3 },
  ask_user: { backend: 'edge', timeout: 300000, credits: 0.1, retryable: false, maxRetries: 0 },
  update_plan: { backend: 'edge', timeout: 5000, credits: 0, retryable: true, maxRetries: 3 },
  complete_task: { backend: 'edge', timeout: 5000, credits: 0, retryable: true, maxRetries: 3 },

  // Deployment → Swiss K8s
  deploy_preview: { backend: 'k8s_swiss', timeout: 120000, credits: 3, retryable: false, maxRetries: 0 },
};
