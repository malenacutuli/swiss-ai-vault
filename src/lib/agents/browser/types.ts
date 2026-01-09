// Browser automation types for Swiss Agents
// NOTE: Actual Playwright execution happens in Edge Function or Modal.com backend

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number };
}

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: true,
  timeout: 30000,
  viewport: { width: 1920, height: 1080 },
};

export interface BrowserSession {
  id: string;
  taskId: string;
  userId: string;
  status: 'active' | 'idle' | 'closed';
  currentUrl?: string;
  pageTitle?: string;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface NavigateParams {
  url: string;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  screenshot?: boolean;
  timeout?: number;
}

export interface ClickParams {
  selector: string;
  waitForNavigation?: boolean;
  timeout?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
}

export interface TypeParams {
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface ScreenshotParams {
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScrollParams {
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  selector?: string;
}

export interface ExtractParams {
  selector?: string;
  extractType: 'text' | 'html' | 'attribute' | 'links' | 'images' | 'tables';
  attribute?: string;
  limit?: number;
}

export interface WaitParams {
  selector?: string;
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  waitFor?: 'navigation' | 'load' | 'networkidle';
}

export interface BrowserActionResult {
  success: boolean;
  sessionId: string;
  action: string;
  data?: {
    url?: string;
    title?: string;
    statusCode?: number;
    screenshot?: string; // Base64 or storage URL
    screenshotStorageKey?: string;
    content?: string;
    extractedData?: unknown;
    error?: string;
  };
  timing: {
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
  };
  error?: string;
}

export interface PageInfo {
  url: string;
  title: string;
  content?: string;
  links?: Array<{ href: string; text: string }>;
  images?: Array<{ src: string; alt: string }>;
  forms?: Array<{ action: string; method: string; fields: string[] }>;
}

export type BrowserAction =
  | { type: 'navigate'; params: NavigateParams }
  | { type: 'click'; params: ClickParams }
  | { type: 'type'; params: TypeParams }
  | { type: 'screenshot'; params: ScreenshotParams }
  | { type: 'scroll'; params: ScrollParams }
  | { type: 'extract'; params: ExtractParams }
  | { type: 'wait'; params: WaitParams }
  | { type: 'back'; params?: object }
  | { type: 'forward'; params?: object }
  | { type: 'refresh'; params?: object }
  | { type: 'close'; params?: object };
