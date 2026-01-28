/**
 * Base Clinical Tool
 */

import type {
  ClinicalTool, ToolInputSchema, ToolResult,
  ValidationResult, ToolCategory
} from './types.js';
import type { SupportedLanguage } from '../config/languages.js';

export abstract class BaseTool implements ClinicalTool {
  abstract id: string;
  abstract name: string;
  abstract category: ToolCategory;
  abstract description: Record<SupportedLanguage, string>;
  abstract inputSchema: ToolInputSchema;
  abstract citations: string[];

  abstract execute(input: unknown): Promise<ToolResult>;

  validate(input: unknown): ValidationResult {
    const errors: string[] = [];
    const data = input as Record<string, unknown>;

    // Check required fields
    for (const field of this.inputSchema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check types and ranges
    for (const [field, schema] of Object.entries(this.inputSchema.properties)) {
      const value = data[field];
      if (value === undefined) continue;

      // Type check
      if (schema.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
        continue;
      }

      // Range check
      if (schema.type === 'number') {
        if (schema.minimum !== undefined && (value as number) < schema.minimum) {
          errors.push(`${field} must be >= ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && (value as number) > schema.maximum) {
          errors.push(`${field} must be <= ${schema.maximum}`);
        }
      }

      // Enum check
      if (schema.enum && !schema.enum.includes(value as string)) {
        errors.push(`${field} must be one of: ${schema.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  protected createResult(partial: Partial<ToolResult>): ToolResult {
    return {
      success: true,
      toolId: this.id,
      interpretation: { en: '', es: '', fr: '' },
      recommendation: { en: '', es: '', fr: '' },
      citations: this.citations,
      ...partial,
    };
  }
}
