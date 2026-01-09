/**
 * Network Filter for Browser Automation Security
 * 
 * Blocks access to internal networks, cloud metadata endpoints,
 * and dangerous file downloads to prevent SSRF and data exfiltration.
 */

// Blocked URL patterns
const BLOCKED_URL_PATTERNS: RegExp[] = [
  // Localhost and loopback
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/\[::1\]/,
  
  // Private network ranges (RFC 1918)
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  
  // Link-local addresses
  /^https?:\/\/169\.254\./,
  
  // Internal domain suffixes
  /\.internal$/i,
  /\.local$/i,
  /\.localhost$/i,
  /\.intranet$/i,
  /\.corp$/i,
  /\.lan$/i,
  
  // Cloud metadata endpoints (SSRF targets)
  /^https?:\/\/169\.254\.169\.254/,                    // AWS/GCP/Azure metadata
  /^https?:\/\/metadata\.google\.internal/,            // GCP metadata
  /^https?:\/\/metadata\.azure\.internal/,             // Azure metadata
  /^https?:\/\/100\.100\.100\.200/,                    // Alibaba Cloud metadata
  /^https?:\/\/fd00:ec2::254/,                         // AWS IPv6 metadata
  
  // Kubernetes internal
  /^https?:\/\/kubernetes\.default/i,
  /^https?:\/\/.*\.svc\.cluster\.local/i,
  
  // Docker internal
  /^https?:\/\/host\.docker\.internal/i,
  /^https?:\/\/gateway\.docker\.internal/i,
];

// Sensitive domains that require extra caution
const SENSITIVE_DOMAIN_PATTERNS: RegExp[] = [
  /\.gov$/i,
  /\.gov\./i,
  /\.mil$/i,
  /\.edu$/i,
];

// Blocked file extensions for downloads
const BLOCKED_EXTENSIONS: string[] = [
  // Executables
  '.exe', '.msi', '.bat', '.cmd', '.ps1', '.sh', '.bash',
  '.com', '.scr', '.pif', '.vbs', '.vbe', '.js', '.jse',
  '.ws', '.wsf', '.wsc', '.wsh',
  
  // Libraries
  '.dll', '.so', '.dylib', '.sys', '.drv',
  
  // Scripts
  '.reg', '.inf', '.hta', '.cpl',
  
  // Archives with potential exploits
  '.jar', '.war', '.ear',
];

// Blocked content types
const BLOCKED_CONTENT_TYPES: string[] = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-shellscript',
];

export interface NetworkFilterResult {
  allowed: boolean;
  reason?: string;
  category?: 'internal_network' | 'metadata' | 'sensitive' | 'download' | 'content_type';
}

export class NetworkFilter {
  private blockedPatterns: RegExp[];
  private sensitivePatterns: RegExp[];
  private blockedExtensions: string[];
  private blockedContentTypes: string[];
  private allowSensitiveDomains: boolean;

  constructor(options: {
    additionalBlockedPatterns?: RegExp[];
    allowSensitiveDomains?: boolean;
  } = {}) {
    this.blockedPatterns = [
      ...BLOCKED_URL_PATTERNS,
      ...(options.additionalBlockedPatterns || []),
    ];
    this.sensitivePatterns = SENSITIVE_DOMAIN_PATTERNS;
    this.blockedExtensions = BLOCKED_EXTENSIONS;
    this.blockedContentTypes = BLOCKED_CONTENT_TYPES;
    this.allowSensitiveDomains = options.allowSensitiveDomains ?? false;
  }

  /**
   * Check if a URL is blocked
   */
  isUrlBlocked(url: string): NetworkFilterResult {
    // Check internal/metadata patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(url)) {
        return {
          allowed: false,
          reason: `URL matches blocked pattern: ${pattern.source}`,
          category: url.includes('169.254') || url.includes('metadata') 
            ? 'metadata' 
            : 'internal_network',
        };
      }
    }

    // Check sensitive domains (warning, not blocking by default)
    if (!this.allowSensitiveDomains) {
      for (const pattern of this.sensitivePatterns) {
        if (pattern.test(url)) {
          return {
            allowed: false,
            reason: `URL matches sensitive domain pattern: ${pattern.source}`,
            category: 'sensitive',
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a download URL is blocked
   */
  isDownloadBlocked(url: string): NetworkFilterResult {
    const urlLower = url.toLowerCase();
    
    for (const ext of this.blockedExtensions) {
      if (urlLower.endsWith(ext) || urlLower.includes(ext + '?')) {
        return {
          allowed: false,
          reason: `Download blocked: dangerous file extension ${ext}`,
          category: 'download',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if content type is allowed
   */
  isContentTypeAllowed(contentType: string): NetworkFilterResult {
    const typeLower = contentType.toLowerCase();
    
    for (const blocked of this.blockedContentTypes) {
      if (typeLower.includes(blocked)) {
        return {
          allowed: false,
          reason: `Content type blocked: ${contentType}`,
          category: 'content_type',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate a URL before navigation
   */
  validateUrl(url: string): NetworkFilterResult {
    // Check URL format
    try {
      new URL(url);
    } catch {
      return {
        allowed: false,
        reason: 'Invalid URL format',
      };
    }

    // Check blocked patterns
    const urlResult = this.isUrlBlocked(url);
    if (!urlResult.allowed) {
      return urlResult;
    }

    // Check download restrictions
    const downloadResult = this.isDownloadBlocked(url);
    if (!downloadResult.allowed) {
      return downloadResult;
    }

    return { allowed: true };
  }

  /**
   * Sanitize URL for logging (mask credentials)
   */
  sanitizeUrlForLogging(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      if (parsed.username) {
        parsed.username = '***';
      }
      return parsed.toString();
    } catch {
      return url.replace(/:[^:@]+@/, ':***@');
    }
  }

  /**
   * Get blocked patterns (for debugging/testing)
   */
  getBlockedPatterns(): RegExp[] {
    return [...this.blockedPatterns];
  }

  /**
   * Get blocked extensions (for debugging/testing)
   */
  getBlockedExtensions(): string[] {
    return [...this.blockedExtensions];
  }
}

// Singleton instance with default configuration
export const networkFilter = new NetworkFilter();

// Utility function for quick checks
export function isUrlAllowed(url: string): boolean {
  return networkFilter.validateUrl(url).allowed;
}
