/**
 * LAYER 4: OUTPUT VALIDATION
 * 
 * Validates and sanitizes tool outputs before returning to user.
 * - Size truncation (50KB max)
 * - PII detection and masking
 * - Secret detection and masking
 * - Malware pattern detection
 */

import type { ToolResult } from '../tools/types';
import type { ValidationResult, ValidationError, ValidationWarning, SafetyConfig } from './types';
import { DEFAULT_SAFETY_CONFIG } from './types';
import { maskPII, maskSecrets, PII_PATTERNS, SECRET_PATTERNS } from './blacklist';

// Maximum output size (50KB)
const MAX_OUTPUT_SIZE = 50 * 1024;

// Malware indicators
const MALWARE_PATTERNS = [
  // Base64 encoded executables
  /TVqQAAMAAAAEAAAA/,  // MZ header
  /7f454c46/i,          // ELF header
  
  // Suspicious script patterns
  /eval\s*\(\s*base64_decode/i,
  /eval\s*\(\s*gzuncompress/i,
  /eval\s*\(\s*gzinflate/i,
  
  // Obfuscated code patterns
  /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
  /fromCharCode\s*\([^)]{100,}\)/,
  
  // Shell injection in output
  /\$\(\s*curl\s+/i,
  /\$\(\s*wget\s+/i,
];

// Sanitization result
export interface SanitizedOutput {
  output: unknown;
  truncated: boolean;
  piiMasked: number;
  secretsMasked: number;
  sanitized: boolean;
}

export async function validateOutput(
  result: ToolResult,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<ValidationResult> {
  const startTime = performance.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    if (!result.output) {
      return createResult(true, errors, warnings, startTime);
    }

    const serialized = JSON.stringify(result.output);

    // 1. Check for malware patterns
    const malwareResult = detectMalwarePatterns(serialized);
    errors.push(...malwareResult.errors);
    warnings.push(...malwareResult.warnings);

    // 2. Check output size (just warn, truncation happens in sanitize)
    if (serialized.length > config.maxOutputSize) {
      warnings.push({
        code: 'OUTPUT_TRUNCATED',
        message: `Output size ${serialized.length} bytes exceeds limit, will be truncated`,
      });
    }

    // 3. Check for PII
    if (config.enablePIIMasking) {
      const piiResult = detectPII(serialized);
      warnings.push(...piiResult.warnings);
    }

    // 4. Check for secrets
    if (config.enableSecretMasking) {
      const secretResult = detectSecrets(serialized);
      warnings.push(...secretResult.warnings);
    }

    const hasErrors = errors.some(e => e.severity === 'critical' || e.severity === 'error');
    return createResult(!hasErrors, errors, warnings, startTime);

  } catch (error) {
    errors.push({
      code: 'OUTPUT_VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Output validation failed',
      severity: 'critical',
    });
    return createResult(false, errors, warnings, startTime);
  }
}

export function sanitizeOutput(
  result: ToolResult,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): SanitizedOutput {
  if (!result.output) {
    return {
      output: result.output,
      truncated: false,
      piiMasked: 0,
      secretsMasked: 0,
      sanitized: false,
    };
  }

  let serialized = JSON.stringify(result.output);
  let piiMasked = 0;
  let secretsMasked = 0;
  let truncated = false;
  let sanitized = false;

  // 1. Mask PII if enabled
  if (config.enablePIIMasking) {
    const piiResult = maskPIIWithCount(serialized);
    serialized = piiResult.text;
    piiMasked = piiResult.count;
    if (piiMasked > 0) sanitized = true;
  }

  // 2. Mask secrets if enabled
  if (config.enableSecretMasking) {
    const secretResult = maskSecretsWithCount(serialized);
    serialized = secretResult.text;
    secretsMasked = secretResult.count;
    if (secretsMasked > 0) sanitized = true;
  }

  // 3. Truncate if too large
  if (serialized.length > config.maxOutputSize) {
    serialized = truncateOutput(serialized, config.maxOutputSize);
    truncated = true;
    sanitized = true;
  }

  // 4. Parse back to object
  let output: unknown;
  try {
    output = JSON.parse(serialized);
  } catch {
    // If parsing fails, return as string
    output = serialized;
  }

  return {
    output,
    truncated,
    piiMasked,
    secretsMasked,
    sanitized,
  };
}

function detectMalwarePatterns(text: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const pattern of MALWARE_PATTERNS) {
    if (pattern.test(text)) {
      errors.push({
        code: 'MALWARE_DETECTED',
        message: 'Potentially malicious content detected in output',
        severity: 'critical',
      });
      break;
    }
  }

  return { errors, warnings };
}

function detectPII(text: string): { warnings: ValidationWarning[] } {
  const warnings: ValidationWarning[] = [];
  const detectedTypes: string[] = [];

  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) {
      detectedTypes.push(name);
    }
    // Reset regex state
    pattern.lastIndex = 0;
  }

  if (detectedTypes.length > 0) {
    warnings.push({
      code: 'PII_DETECTED',
      message: `PII detected in output: ${detectedTypes.join(', ')}`,
    });
  }

  return { warnings };
}

function detectSecrets(text: string): { warnings: ValidationWarning[] } {
  const warnings: ValidationWarning[] = [];
  const detectedTypes: string[] = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      detectedTypes.push(name);
    }
    // Reset regex state
    pattern.lastIndex = 0;
  }

  if (detectedTypes.length > 0) {
    warnings.push({
      code: 'SECRETS_DETECTED',
      message: `Potential secrets detected: ${detectedTypes.join(', ')}`,
    });
  }

  return { warnings };
}

function maskPIIWithCount(text: string): { text: string; count: number } {
  let count = 0;
  let masked = text;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const matches = masked.match(pattern);
    if (matches) {
      count += matches.length;
    }
    masked = masked.replace(pattern, replacement);
    // Reset regex state
    pattern.lastIndex = 0;
  }

  return { text: masked, count };
}

function maskSecretsWithCount(text: string): { text: string; count: number } {
  let count = 0;
  let masked = text;

  for (const { pattern, replacement } of SECRET_PATTERNS) {
    const matches = masked.match(pattern);
    if (matches) {
      count += matches.length;
    }
    masked = masked.replace(pattern, replacement);
    // Reset regex state
    pattern.lastIndex = 0;
  }

  return { text: masked, count };
}

function truncateOutput(text: string, maxSize: number): string {
  if (text.length <= maxSize) {
    return text;
  }

  // Find a good truncation point (end of a complete JSON value if possible)
  const truncateAt = maxSize - 100; // Leave room for truncation marker
  
  // Try to find the last complete value
  let cutPoint = truncateAt;
  const lastComma = text.lastIndexOf(',', truncateAt);
  const lastBrace = text.lastIndexOf('}', truncateAt);
  const lastBracket = text.lastIndexOf(']', truncateAt);
  
  cutPoint = Math.max(lastComma, lastBrace, lastBracket, truncateAt - 500);
  
  // Create truncated output
  const truncated = text.substring(0, cutPoint);
  
  // Try to make it valid JSON by closing open structures
  let result = truncated;
  const openBraces = (truncated.match(/{/g) || []).length;
  const closeBraces = (truncated.match(/}/g) || []).length;
  const openBrackets = (truncated.match(/\[/g) || []).length;
  const closeBrackets = (truncated.match(/]/g) || []).length;
  
  // Add truncation indicator
  if (result.endsWith(',')) {
    result = result.slice(0, -1);
  }
  result += ',"_truncated":true';
  
  // Close structures
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    result += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    result += '}';
  }
  
  return result;
}

function createResult(
  valid: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  startTime: number
): ValidationResult {
  return {
    valid,
    errors,
    warnings,
    durationMs: performance.now() - startTime,
  };
}
