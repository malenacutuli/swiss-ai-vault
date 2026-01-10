import type { Tool } from './types';

/**
 * Blocked command patterns for security
 * These commands are never allowed to execute
 */
const BLOCKED_COMMANDS: RegExp[] = [
  // Destructive system operations
  /rm\s+-rf\s+[\/~]/,           // rm -rf on root or home
  /rm\s+-rf\s+\.\.\//,          // rm -rf traversal
  /:\(\)\{.*\}.*:/,              // Fork bomb
  /dd\s+if=\/dev/,               // Direct disk writes
  /mkfs\./,                      // Filesystem creation
  /chmod\s+-R\s+777/,            // Insecure permissions
  />\s*\/dev\/sda/,              // Direct disk access
  
  // Remote code execution
  /wget.*\|\s*(ba)?sh/,          // Download and execute
  /curl.*\|\s*(ba)?sh/,          // Download and execute
  /python.*-c.*import\s+os/,     // Python system access
  /eval\s*\(/,                   // Eval execution
  
  // Privilege escalation
  /sudo\s+/,                     // Sudo usage
  /su\s+-/,                      // User switching
  /passwd/,                      // Password modification
  /chown\s+-R\s+root/,           // Root ownership
  
  // Network attacks
  /nmap\s+/,                     // Port scanning
  /nc\s+-l/,                     // Netcat listener
  /iptables\s+-F/,               // Firewall flush
  
  // Crypto mining
  /xmrig/i,                      // XMRig miner
  /minerd/i,                     // CPU miner
  /cryptonight/i,                // Cryptonight algorithm
];

/**
 * Suspicious patterns that require user confirmation
 */
const SUSPICIOUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /rm\s+-rf/, reason: 'Recursive deletion' },
  { pattern: />\s*\//, reason: 'Writing to system paths' },
  { pattern: /git\s+push\s+.*--force/, reason: 'Force push to repository' },
  { pattern: /npm\s+publish/, reason: 'Publishing package' },
  { pattern: /docker\s+rm/, reason: 'Removing Docker containers' },
  { pattern: /DROP\s+TABLE/i, reason: 'Dropping database table' },
  { pattern: /DELETE\s+FROM.*WHERE\s+1/i, reason: 'Mass deletion' },
  { pattern: /curl.*-X\s+DELETE/, reason: 'HTTP DELETE request' },
  { pattern: /\.env/, reason: 'Accessing environment file' },
  { pattern: /password|secret|api_key|token/i, reason: 'Sensitive data access' },
];

/**
 * Allowed file paths patterns (whitelist approach)
 */
const ALLOWED_PATH_PREFIXES = [
  '/home/sandbox/',
  './src/',
  './public/',
  './tests/',
  './docs/',
  './scripts/',
  './',
];

/**
 * Blocked file paths (sensitive files)
 */
const BLOCKED_PATHS: string[] = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '~/.ssh/',
  '~/.aws/',
  '~/.gnupg/',
  '.env',
  '.env.local',
  '.env.production',
  'id_rsa',
  'id_ed25519',
];

export interface SafetyValidationResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
  blockedBy?: 'pattern' | 'path' | 'safety_level';
  suggestions?: string[];
}

/**
 * Validate a command against security rules
 */
export function validateCommand(command: string): SafetyValidationResult {
  // Check blocked patterns
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'This command matches a blocked security pattern',
        blockedBy: 'pattern',
      };
    }
  }
  
  // Check suspicious patterns
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Command contains suspicious pattern: ${reason}`,
      };
    }
  }
  
  return { allowed: true, requiresConfirmation: false };
}

/**
 * Validate a file path against security rules
 */
export function validatePath(path: string): SafetyValidationResult {
  // Normalize path
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
  
  // Check blocked paths
  for (const blockedPath of BLOCKED_PATHS) {
    if (normalizedPath.includes(blockedPath.toLowerCase())) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: `Access to ${blockedPath} is blocked for security reasons`,
        blockedBy: 'path',
      };
    }
  }
  
  // Check path traversal attempts
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: 'Path traversal is not allowed',
      blockedBy: 'path',
    };
  }
  
  // For absolute paths, verify they're in allowed prefixes
  if (path.startsWith('/') && !path.startsWith('/home/sandbox/')) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: 'Accessing path outside sandbox workspace',
    };
  }
  
  return { allowed: true, requiresConfirmation: false };
}

/**
 * Validate URL against security rules
 */
export function validateUrl(url: string): SafetyValidationResult {
  try {
    const parsed = new URL(url);
    
    // Block local/internal URLs
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(parsed.hostname)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'Access to localhost is blocked',
        blockedBy: 'pattern',
      };
    }
    
    // Block private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];
    
    for (const range of privateRanges) {
      if (range.test(parsed.hostname)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: 'Access to private IP ranges is blocked',
          blockedBy: 'pattern',
        };
      }
    }
    
    // Block file:// protocol
    if (parsed.protocol === 'file:') {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'File protocol is not allowed',
        blockedBy: 'pattern',
      };
    }
    
    return { allowed: true, requiresConfirmation: false };
  } catch {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: 'Invalid URL format',
      blockedBy: 'pattern',
    };
  }
}

/**
 * Main safety validation function for tools
 */
export function validateSafety(
  tool: Tool, 
  params: Record<string, unknown>
): SafetyValidationResult {
  // Check tool safety level
  if (tool.safety === 'dangerous') {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: `${tool.name} is classified as a dangerous operation`,
      blockedBy: 'safety_level',
    };
  }
  
  // Tool-specific validations
  switch (tool.name) {
    case 'shell.exec': {
      const command = params.command as string;
      if (command) {
        return validateCommand(command);
      }
      break;
    }
    
    case 'file.read':
    case 'file.write':
    case 'file.edit':
    case 'file.delete': {
      const path = params.path as string;
      if (path) {
        const pathResult = validatePath(path);
        // File deletion always requires confirmation
        if (tool.name === 'file.delete' && pathResult.allowed) {
          return {
            allowed: true,
            requiresConfirmation: true,
            reason: 'File deletion requires confirmation',
          };
        }
        return pathResult;
      }
      break;
    }
    
    case 'browser.navigate': {
      const url = params.url as string;
      if (url) {
        return validateUrl(url);
      }
      break;
    }
  }
  
  return { allowed: true, requiresConfirmation: false };
}

/**
 * Sanitize command for logging (hide sensitive data)
 */
export function sanitizeForLogging(content: string): string {
  return content
    .replace(/(api[_-]?key|password|secret|token|authorization|bearer)[:\s=]+\S+/gi, '$1=[REDACTED]')
    .replace(/[a-f0-9]{32,}/gi, '[HASH_REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]');
}

/**
 * Rate limiting configuration per tool
 */
export const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  'shell.exec': { requests: 10, windowMs: 60000 },
  'shell.view': { requests: 30, windowMs: 60000 },
  'file.read': { requests: 50, windowMs: 60000 },
  'file.write': { requests: 30, windowMs: 60000 },
  'file.edit': { requests: 30, windowMs: 60000 },
  'file.delete': { requests: 10, windowMs: 60000 },
  'browser.navigate': { requests: 20, windowMs: 60000 },
  'browser.click': { requests: 30, windowMs: 60000 },
  'browser.type': { requests: 30, windowMs: 60000 },
  'browser.screenshot': { requests: 20, windowMs: 60000 },
  'search.web': { requests: 20, windowMs: 60000 },
  'search.code': { requests: 30, windowMs: 60000 },
  'webdev.init': { requests: 5, windowMs: 300000 },
  'webdev.preview': { requests: 10, windowMs: 60000 },
  'plan.update': { requests: 20, windowMs: 60000 },
  'plan.advance': { requests: 30, windowMs: 60000 },
  'message.info': { requests: 50, windowMs: 60000 },
  'message.ask': { requests: 20, windowMs: 60000 },
};

/**
 * Get safety classification summary
 */
export function getToolSafetyClassification(): {
  safe: string[];
  moderate: string[];
  dangerous: string[];
} {
  return {
    safe: [
      'shell.view',
      'file.read',
      'browser.screenshot',
      'search.web',
      'search.code',
      'plan.update',
      'plan.advance',
      'message.info',
      'message.ask',
    ],
    moderate: [
      'file.write',
      'file.edit',
      'browser.navigate',
      'browser.click',
      'browser.type',
      'webdev.init',
      'webdev.preview',
    ],
    dangerous: [
      'shell.exec',
      'file.delete',
    ],
  };
}

console.log('[Safety] Security validation module loaded');
