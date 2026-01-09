// Browser automation exports
export * from './types';
export { BrowserClient, createBrowserClient } from './BrowserClient';
export { browserTools, getBrowserTool } from './tools';
export {
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  browserScroll,
  browserExtract,
  browserWait,
  browserFillForm,
} from './tools';

// Security exports
export {
  NetworkFilter,
  networkFilter,
  isUrlAllowed,
  ResourceLimiter,
  resourceLimiter,
  DEFAULT_RESOURCE_LIMITS,
  SessionPersistence,
  createSessionPersistence,
  ContentSecurityManager,
  contentSecurityManager,
  DEFAULT_CSP,
  STRICT_CSP,
} from './security';

export type {
  NetworkFilterResult,
  ResourceLimits,
  SessionResources,
  ResourceCheckResult,
  StorageState,
  Cookie,
  PersistedSession,
  ContentSecurityPolicy,
} from './security';
