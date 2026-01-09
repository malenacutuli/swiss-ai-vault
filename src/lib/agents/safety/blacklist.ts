// Blocked shell commands - system destruction
export const BLOCKED_SYSTEM_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf .',
  'mkfs',
  'dd if=/dev/',
  'dd of=/dev/',
  ':(){:|:&};:',  // Fork bomb
  '> /dev/sda',
  'mv / /dev/null',
  'chmod -R 000 /',
  'chown -R nobody:nobody /',
] as const;

// Privilege escalation commands
export const BLOCKED_PRIVILEGE_COMMANDS = [
  'sudo ',
  'sudo -i',
  'sudo su',
  'su -',
  'su root',
  'chmod 777',
  'chmod +s',
  'setuid',
  'setgid',
  'pkexec',
  'doas ',
] as const;

// Network attack tools
export const BLOCKED_NETWORK_COMMANDS = [
  'nmap ',
  'netcat ',
  'nc -',
  'nc -e',
  'hping',
  'masscan',
  'zmap',
  'arpspoof',
  'ettercap',
  'bettercap',
  'tcpdump -w',
  'wireshark',
] as const;

// Crypto mining
export const BLOCKED_CRYPTO_COMMANDS = [
  'xmrig',
  'minerd',
  'cgminer',
  'bfgminer',
  'cpuminer',
  'ethminer',
  'nicehash',
  'minergate',
  'coinhive',
] as const;

// Data exfiltration patterns
export const BLOCKED_EXFIL_COMMANDS = [
  'curl | bash',
  'curl | sh',
  'wget | bash',
  'wget | sh',
  'curl -X POST',
  'wget --post-data',
  'base64 | curl',
  'cat /etc/passwd',
  'cat /etc/shadow',
  'cat ~/.ssh/id_rsa',
  'tar czf - / |',
] as const;

// Reverse shell patterns
export const BLOCKED_REVERSE_SHELL = [
  '/dev/tcp/',
  '/dev/udp/',
  'bash -i >&',
  'python -c "import socket"',
  'php -r "$sock=fsockopen"',
  'ruby -rsocket',
  'perl -e "use Socket"',
  'nc -lnvp',
  'socat exec',
  'msfvenom',
  'msfconsole',
] as const;

// Combine all blocked patterns
export const BLOCKED_COMMANDS = [
  ...BLOCKED_SYSTEM_COMMANDS,
  ...BLOCKED_PRIVILEGE_COMMANDS,
  ...BLOCKED_NETWORK_COMMANDS,
  ...BLOCKED_CRYPTO_COMMANDS,
  ...BLOCKED_EXFIL_COMMANDS,
  ...BLOCKED_REVERSE_SHELL,
] as const;

// Regex patterns for more sophisticated detection
export const BLOCKED_PATTERNS: RegExp[] = [
  // System destruction
  /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?[\/~]/i,
  /rm\s+(-[a-z]*r[a-z]*\s+)?(-[a-z]*f[a-z]*\s+)?[\/~]/i,
  />\s*\/dev\/[a-z]+/i,
  
  // Privilege escalation
  /sudo\s+/i,
  /su\s+-/i,
  /chmod\s+[0-7]*7[0-7]*/i,
  
  // Network attacks
  /nmap\s+/i,
  /nc\s+-[a-z]*[elp]/i,
  
  // Crypto mining
  /miner/i,
  
  // Data exfiltration
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
  /curl.*\|.*bash/i,
  /wget.*\|.*bash/i,
  
  // Reverse shell
  /\/dev\/tcp\//i,
  /bash\s+-i\s+>&/i,
  /python[23]?\s+-c.*socket/i,
  /php\s+-r.*fsockopen/i,
  
  // Environment variable injection
  /\$\(.*\)/,  // Command substitution
  /`.*`/,      // Backtick command substitution
  /\$\{.*\}/,  // Variable expansion
];

// SQL injection patterns
export const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,  // OR 1=1
  /(\bUNION\b.*\bSELECT\b)/i,
  /(--\s*$|;\s*--)/,  // SQL comments
  /(\bEXEC\b|\bEXECUTE\b)/i,
  /(\bxp_\w+)/i,  // SQL Server extended procedures
];

// Path traversal patterns
export const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\\/, 
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\.%2e\//i,
  /%2e\.\//i,
  /\.\.\%2f/i,
  /\.\.%5c/i,
];

// PII patterns for output masking
export const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL REDACTED]' },
  { name: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE REDACTED]' },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
  { name: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD REDACTED]' },
  { name: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP REDACTED]' },
];

// Secret patterns for output masking
export const SECRET_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_KEY REDACTED]' },
  { name: 'aws_secret', pattern: /[a-zA-Z0-9/+=]{40}/g, replacement: '[AWS_SECRET REDACTED]' },
  { name: 'github_token', pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g, replacement: '[GITHUB_TOKEN REDACTED]' },
  { name: 'generic_api_key', pattern: /(api[_-]?key|apikey|secret[_-]?key|auth[_-]?token)['":\s]*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, replacement: '[API_KEY REDACTED]' },
  { name: 'jwt', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[JWT REDACTED]' },
  { name: 'private_key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY REDACTED]' },
];

// Check if a command contains blocked patterns
export function isCommandBlocked(command: string): { blocked: boolean; reason?: string } {
  const normalizedCmd = command.toLowerCase().trim();
  
  // Check exact matches
  for (const blocked of BLOCKED_COMMANDS) {
    if (normalizedCmd.includes(blocked.toLowerCase())) {
      return { blocked: true, reason: `Blocked command pattern: ${blocked}` };
    }
  }
  
  // Check regex patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { blocked: true, reason: `Blocked pattern detected: ${pattern.source}` };
    }
  }
  
  return { blocked: false };
}

// Check for SQL injection
export function hasSQLInjection(input: string): boolean {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

// Check for path traversal
export function hasPathTraversal(path: string): boolean {
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}

// Mask PII in output
export function maskPII(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// Mask secrets in output
export function maskSecrets(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}
