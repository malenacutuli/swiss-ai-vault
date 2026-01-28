/**
 * HELIOS Clinical Tools Registry
 * Central registry for all clinical calculators
 */

import type { ClinicalTool, ToolCategory, ToolResult } from './types.js';
import { heartScoreTool } from './calculators/heart-score.js';
import { wellsDVTTool } from './calculators/wells-dvt.js';
import { nihssTool } from './calculators/nihss.js';
import { curb65Tool } from './calculators/curb65.js';
import { qsofaTool } from './calculators/qsofa.js';
import { patTool } from './calculators/pediatric-assessment.js';
import { logger } from '../utils/logger.js';

class ToolsRegistry {
  private tools: Map<string, ClinicalTool> = new Map();

  constructor() {
    // Register all tools
    this.register(heartScoreTool);
    this.register(wellsDVTTool);
    this.register(nihssTool);
    this.register(curb65Tool);
    this.register(qsofaTool);
    this.register(patTool);

    logger.info('Clinical tools registry initialized', {
      toolCount: this.tools.size,
    });
  }

  register(tool: ClinicalTool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): ClinicalTool | undefined {
    return this.tools.get(id);
  }

  list(): ClinicalTool[] {
    return Array.from(this.tools.values());
  }

  listByCategory(category: ToolCategory): ClinicalTool[] {
    return this.list().filter(t => t.category === category);
  }

  async execute(toolId: string, input: unknown): Promise<ToolResult> {
    const tool = this.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const validation = tool.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return tool.execute(input);
  }

  getSchema(toolId: string) {
    const tool = this.get(toolId);
    if (!tool) return null;

    return {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      inputSchema: tool.inputSchema,
      citations: tool.citations,
    };
  }

  listSchemas() {
    return this.list().map(t => this.getSchema(t.id));
  }
}

export const toolsRegistry = new ToolsRegistry();
