/**
 * LAYER 1: INPUT VALIDATION
 * 
 * Validates all inputs before they reach the tool execution layer.
 * - Schema validation
 * - Injection detection (SQL, command, path traversal)
 * - Size limits
 * - Character filtering
 */

import type { Tool } from '../tools/types';
import type { ValidationResult, ValidationError, ValidationWarning, SafetyConfig } from './types';
import { DEFAULT_SAFETY_CONFIG } from './types';
import { 
  isCommandBlocked, 
  hasSQLInjection, 
  hasPathTraversal,
  BLOCKED_PATTERNS 
} from './blacklist';

// Dangerous characters that might indicate injection attempts
const DANGEROUS_CHARS = /[\x00-\x1F\x7F]|[\u0000-\u001F\u007F]/g;

export async function validateInput(
  tool: Tool,
  params: unknown,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<ValidationResult> {
  const startTime = performance.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // 1. Check if params exist
    if (params === undefined || params === null) {
      errors.push({
        code: 'MISSING_PARAMS',
        message: 'Tool parameters are required',
        severity: 'error',
      });
      return createResult(false, errors, warnings, startTime);
    }

    // 2. Validate against schema
    const schemaResult = validateSchema(tool, params);
    errors.push(...schemaResult.errors);
    warnings.push(...schemaResult.warnings);

    // 3. Check input size
    const sizeResult = validateSize(params, config.maxInputSize);
    errors.push(...sizeResult.errors);
    warnings.push(...sizeResult.warnings);

    // 4. Check for injection attacks
    const injectionResult = validateInjection(tool, params);
    errors.push(...injectionResult.errors);
    warnings.push(...injectionResult.warnings);

    // 5. Check for dangerous characters
    const charResult = validateCharacters(params);
    errors.push(...charResult.errors);
    warnings.push(...charResult.warnings);

    // 6. Tool-specific validation
    const toolResult = validateToolSpecific(tool, params);
    errors.push(...toolResult.errors);
    warnings.push(...toolResult.warnings);

    const hasErrors = errors.some(e => e.severity === 'critical' || e.severity === 'error');
    return createResult(!hasErrors, errors, warnings, startTime);

  } catch (error) {
    errors.push({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Validation failed',
      severity: 'critical',
    });
    return createResult(false, errors, warnings, startTime);
  }
}

function validateSchema(tool: Tool, params: unknown): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    tool.schema.parse(params);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'errors' in error) {
      const zodError = error as { errors: Array<{ path: (string | number)[]; message: string }> };
      for (const issue of zodError.errors) {
        errors.push({
          code: 'SCHEMA_VALIDATION',
          message: issue.message,
          field: issue.path.join('.'),
          severity: 'error',
        });
      }
    } else {
      errors.push({
        code: 'SCHEMA_VALIDATION',
        message: 'Schema validation failed',
        severity: 'error',
      });
    }
  }

  return { errors, warnings };
}

function validateSize(params: unknown, maxSize: number): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const serialized = JSON.stringify(params);
  const size = new TextEncoder().encode(serialized).length;

  if (size > maxSize) {
    errors.push({
      code: 'INPUT_TOO_LARGE',
      message: `Input size ${size} bytes exceeds maximum ${maxSize} bytes`,
      severity: 'error',
    });
  } else if (size > maxSize * 0.8) {
    warnings.push({
      code: 'INPUT_SIZE_WARNING',
      message: `Input size ${size} bytes approaching limit of ${maxSize} bytes`,
    });
  }

  return { errors, warnings };
}

function validateInjection(tool: Tool, params: unknown): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const stringValues = extractStringValues(params);

  for (const { path, value } of stringValues) {
    // Check for command injection in shell tools
    if (tool.category === 'shell' && path.includes('command')) {
      const blockCheck = isCommandBlocked(value);
      if (blockCheck.blocked) {
        errors.push({
          code: 'BLOCKED_COMMAND',
          message: blockCheck.reason || 'Command contains blocked pattern',
          field: path,
          severity: 'critical',
        });
      }
    }

    // Check for SQL injection
    if (hasSQLInjection(value)) {
      errors.push({
        code: 'SQL_INJECTION',
        message: 'Potential SQL injection detected',
        field: path,
        severity: 'critical',
      });
    }

    // Check for path traversal in file operations
    if (tool.category === 'file' && (path.includes('path') || path.includes('file'))) {
      if (hasPathTraversal(value)) {
        errors.push({
          code: 'PATH_TRAVERSAL',
          message: 'Path traversal attempt detected',
          field: path,
          severity: 'critical',
        });
      }
    }

    // Check for command substitution in any string
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(value)) {
        warnings.push({
          code: 'SUSPICIOUS_PATTERN',
          message: `Suspicious pattern detected: ${pattern.source}`,
          field: path,
        });
        break;
      }
    }
  }

  return { errors, warnings };
}

function validateCharacters(params: unknown): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const stringValues = extractStringValues(params);

  for (const { path, value } of stringValues) {
    if (DANGEROUS_CHARS.test(value)) {
      warnings.push({
        code: 'DANGEROUS_CHARS',
        message: 'Input contains potentially dangerous control characters',
        field: path,
      });
    }
  }

  return { errors, warnings };
}

function validateToolSpecific(tool: Tool, params: unknown): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const p = params as Record<string, unknown>;

  switch (tool.name) {
    case 'shell.exec':
      // Additional shell command validation
      if (typeof p.command === 'string') {
        if (p.command.length > 10000) {
          errors.push({
            code: 'COMMAND_TOO_LONG',
            message: 'Shell command exceeds maximum length',
            field: 'command',
            severity: 'error',
          });
        }
        // Check for multiple chained commands
        if ((p.command.match(/[;&|]{2,}/g) || []).length > 5) {
          warnings.push({
            code: 'MANY_CHAINED_COMMANDS',
            message: 'Command contains many chained operations',
            field: 'command',
          });
        }
      }
      break;

    case 'file.write':
    case 'file.edit':
      // Check content size
      if (typeof p.content === 'string' && p.content.length > 1000000) {
        errors.push({
          code: 'CONTENT_TOO_LARGE',
          message: 'File content exceeds 1MB limit',
          field: 'content',
          severity: 'error',
        });
      }
      break;

    case 'browser.navigate':
      // Validate URL safety
      if (typeof p.url === 'string') {
        try {
          const url = new URL(p.url);
          // Block dangerous protocols
          if (['javascript:', 'data:', 'file:', 'about:'].includes(url.protocol)) {
            errors.push({
              code: 'DANGEROUS_PROTOCOL',
              message: `Blocked protocol: ${url.protocol}`,
              field: 'url',
              severity: 'critical',
            });
          }
        } catch {
          errors.push({
            code: 'INVALID_URL',
            message: 'Invalid URL format',
            field: 'url',
            severity: 'error',
          });
        }
      }
      break;
  }

  return { errors, warnings };
}

// Helper to extract all string values from an object with their paths
function extractStringValues(obj: unknown, path = ''): Array<{ path: string; value: string }> {
  const results: Array<{ path: string; value: string }> = [];

  if (typeof obj === 'string') {
    results.push({ path: path || 'root', value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results.push(...extractStringValues(item, `${path}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      results.push(...extractStringValues(value, path ? `${path}.${key}` : key));
    }
  }

  return results;
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
