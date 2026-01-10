// src/lib/agents/SafetyValidator.ts
// Safety validation for Swiss Agents tool execution

export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SafetyRule {
  name: string;
  description: string;
  check: (toolCall: ToolCall) => ValidationResult;
}

// Dangerous command patterns
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,           // Recursive force delete from root/home
  /mkfs/i,                        // Format filesystem
  /dd\s+if=/i,                    // Direct disk write
  /:\(\)\s*{\s*:\|:\s*&\s*}/,    // Fork bomb
  />\s*\/dev\/sd[a-z]/i,         // Write to disk device
  /chmod\s+-R\s+777/i,           // Insecure permissions
  /curl.*\|\s*bash/i,            // Pipe curl to bash
  /wget.*\|\s*sh/i,              // Pipe wget to shell
  /eval\s*\(/i,                   // Eval injection
  /\$\(.*\)/,                     // Command substitution (moderate risk)
];

// Commands requiring confirmation
const CONFIRMATION_PATTERNS = [
  /sudo/i,
  /rm\s+-/i,
  /git\s+push/i,
  /npm\s+publish/i,
  /docker\s+rm/i,
  /kubectl\s+delete/i,
];

// Blocked file paths
const BLOCKED_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '~/.ssh/',
  '~/.aws/',
  '~/.config/',
  '/root/',
];

// PII patterns
const PII_PATTERNS = [
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/i, // IBAN
  /\b\d{3}-\d{2}-\d{4}\b/,                              // SSN
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/,                        // Credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
];

export class SafetyValidator {
  private rules: SafetyRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Rule 1: Block dangerous shell commands
    this.rules.push({
      name: 'dangerous_commands',
      description: 'Block known dangerous shell commands',
      check: (toolCall) => {
        if (toolCall.name !== 'shell_exec' && toolCall.name !== 'shell.exec') {
          return { allowed: true };
        }

        const command = toolCall.parameters.command as string;
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(command)) {
            return {
              allowed: false,
              reason: `Dangerous command pattern detected: ${pattern.toString()}`,
              riskLevel: 'critical'
            };
          }
        }

        return { allowed: true };
      }
    });

    // Rule 2: Require confirmation for sensitive commands
    this.rules.push({
      name: 'confirmation_required',
      description: 'Require user confirmation for sensitive operations',
      check: (toolCall) => {
        if (toolCall.name !== 'shell_exec' && toolCall.name !== 'shell.exec') {
          return { allowed: true };
        }

        const command = toolCall.parameters.command as string;
        for (const pattern of CONFIRMATION_PATTERNS) {
          if (pattern.test(command)) {
            return {
              allowed: true,
              requiresConfirmation: true,
              reason: `Sensitive command requires confirmation: ${command.substring(0, 50)}`,
              riskLevel: 'high'
            };
          }
        }

        return { allowed: true };
      }
    });

    // Rule 3: Block access to sensitive files
    this.rules.push({
      name: 'blocked_paths',
      description: 'Block access to sensitive file paths',
      check: (toolCall) => {
        if (toolCall.name !== 'file_read' && toolCall.name !== 'file_write' && 
            toolCall.name !== 'file.read' && toolCall.name !== 'file.write') {
          return { allowed: true };
        }

        const filePath = (toolCall.parameters.path || toolCall.parameters.file) as string;
        for (const blocked of BLOCKED_PATHS) {
          if (filePath.includes(blocked.replace('~', ''))) {
            return {
              allowed: false,
              reason: `Access to sensitive path blocked: ${filePath}`,
              riskLevel: 'critical'
            };
          }
        }

        return { allowed: true };
      }
    });

    // Rule 4: Check for PII in outputs
    this.rules.push({
      name: 'pii_detection',
      description: 'Detect and warn about PII in data',
      check: (toolCall) => {
        const params = JSON.stringify(toolCall.parameters);
        for (const pattern of PII_PATTERNS) {
          if (pattern.test(params)) {
            return {
              allowed: true,
              requiresConfirmation: true,
              reason: 'Potential PII detected in parameters',
              riskLevel: 'medium'
            };
          }
        }

        return { allowed: true };
      }
    });

    // Rule 5: Rate limiting simulation
    this.rules.push({
      name: 'rate_limit',
      description: 'Prevent excessive tool calls',
      check: (_toolCall) => {
        // In production, this would check actual rate limits
        return { allowed: true };
      }
    });
  }

  async validate(toolCall: ToolCall): Promise<ValidationResult> {
    let requiresConfirmation = false;
    let highestRisk: ValidationResult['riskLevel'] = 'low';
    const warnings: string[] = [];

    for (const rule of this.rules) {
      const result = rule.check(toolCall);
      
      if (!result.allowed) {
        return result;
      }

      if (result.requiresConfirmation) {
        requiresConfirmation = true;
        if (result.reason) {
          warnings.push(result.reason);
        }
      }

      if (result.riskLevel) {
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const currentLevel = riskLevels.indexOf(highestRisk);
        const newLevel = riskLevels.indexOf(result.riskLevel);
        if (newLevel > currentLevel) {
          highestRisk = result.riskLevel;
        }
      }
    }

    return {
      allowed: true,
      requiresConfirmation,
      reason: warnings.length > 0 ? warnings.join('; ') : undefined,
      riskLevel: highestRisk
    };
  }

  addRule(rule: SafetyRule): void {
    this.rules.push(rule);
  }

  removeRule(name: string): void {
    this.rules = this.rules.filter(r => r.name !== name);
  }

  getRules(): SafetyRule[] {
    return [...this.rules];
  }
}
