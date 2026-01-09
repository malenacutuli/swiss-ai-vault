/**
 * Content Security Policy for Browser Automation
 * 
 * Defines what content can be loaded and executed
 * in automated browser sessions.
 */

export interface ContentSecurityPolicy {
  allowScripts: boolean;
  allowInlineScripts: boolean;
  allowExternalImages: boolean;
  allowIframes: boolean;
  allowForms: boolean;
  allowPopups: boolean;
  blockedDomains: string[];
  allowedDomains: string[];
}

export const DEFAULT_CSP: ContentSecurityPolicy = {
  allowScripts: true,
  allowInlineScripts: true,
  allowExternalImages: true,
  allowIframes: false,
  allowForms: true,
  allowPopups: false,
  blockedDomains: [
    'malware.com',
    'phishing.com',
  ],
  allowedDomains: [], // Empty means all non-blocked domains allowed
};

export const STRICT_CSP: ContentSecurityPolicy = {
  allowScripts: true,
  allowInlineScripts: false,
  allowExternalImages: true,
  allowIframes: false,
  allowForms: false,
  allowPopups: false,
  blockedDomains: [],
  allowedDomains: [],
};

export class ContentSecurityManager {
  private policy: ContentSecurityPolicy;

  constructor(policy: Partial<ContentSecurityPolicy> = {}) {
    this.policy = { ...DEFAULT_CSP, ...policy };
  }

  /**
   * Check if a domain is allowed
   */
  isDomainAllowed(domain: string): boolean {
    // Check blocked list first
    if (this.policy.blockedDomains.some(blocked => 
      domain.includes(blocked) || domain.endsWith(`.${blocked}`)
    )) {
      return false;
    }

    // If allowlist is specified, check it
    if (this.policy.allowedDomains.length > 0) {
      return this.policy.allowedDomains.some(allowed =>
        domain === allowed || domain.endsWith(`.${allowed}`)
      );
    }

    return true;
  }

  /**
   * Check if scripts are allowed
   */
  areScriptsAllowed(): boolean {
    return this.policy.allowScripts;
  }

  /**
   * Check if inline scripts are allowed
   */
  areInlineScriptsAllowed(): boolean {
    return this.policy.allowInlineScripts;
  }

  /**
   * Check if iframes are allowed
   */
  areIframesAllowed(): boolean {
    return this.policy.allowIframes;
  }

  /**
   * Check if forms are allowed
   */
  areFormsAllowed(): boolean {
    return this.policy.allowForms;
  }

  /**
   * Check if popups are allowed
   */
  arePopupsAllowed(): boolean {
    return this.policy.allowPopups;
  }

  /**
   * Get the current policy
   */
  getPolicy(): ContentSecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Update policy
   */
  updatePolicy(updates: Partial<ContentSecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Add domain to blocked list
   */
  blockDomain(domain: string): void {
    if (!this.policy.blockedDomains.includes(domain)) {
      this.policy.blockedDomains.push(domain);
    }
  }

  /**
   * Remove domain from blocked list
   */
  unblockDomain(domain: string): void {
    this.policy.blockedDomains = this.policy.blockedDomains.filter(d => d !== domain);
  }

  /**
   * Generate CSP header string
   */
  toHeaderString(): string {
    const directives: string[] = [];

    // Default source
    directives.push("default-src 'self'");

    // Script source
    if (this.policy.allowScripts) {
      const scriptSrc = this.policy.allowInlineScripts
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self'";
      directives.push(scriptSrc);
    } else {
      directives.push("script-src 'none'");
    }

    // Image source
    if (this.policy.allowExternalImages) {
      directives.push("img-src 'self' data: https:");
    } else {
      directives.push("img-src 'self' data:");
    }

    // Frame source
    if (!this.policy.allowIframes) {
      directives.push("frame-src 'none'");
    }

    // Form action
    if (!this.policy.allowForms) {
      directives.push("form-action 'none'");
    }

    return directives.join('; ');
  }
}

// Singleton with default policy
export const contentSecurityManager = new ContentSecurityManager();
