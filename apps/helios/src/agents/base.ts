/**
 * HELIOS Base Agent
 * Foundation class for all clinical agents
 */

import Anthropic from '@anthropic-ai/sdk';
import type { 
  AgentConfig, AgentContext, AgentInput, AgentOutput 
} from './types.js';
import type { SupportedLanguage } from '../config/languages.js';
import { logger } from '../utils/logger.js';
import { now } from '../utils/index.js';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected client: Anthropic;
  
  constructor(config: AgentConfig, client: Anthropic) {
    this.config = config;
    this.client = client;
  }
  
  // ========================================
  // ABSTRACT METHODS - Must implement
  // ========================================
  
  /**
   * Get system prompt for this agent
   * Override to provide language-specific prompts
   */
  abstract getSystemPrompt(language: SupportedLanguage): string;
  
  /**
   * Process output from Claude into structured format
   */
  abstract parseOutput(response: string, context: AgentContext): Partial<AgentOutput>;
  
  // ========================================
  // CORE EXECUTION
  // ========================================
  
  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const { context } = input;
    
    logger.info('Agent executing', {
      agentId: this.config.id,
      role: this.config.role,
      sessionId: context.sessionId,
      phase: context.currentPhase,
    });
    
    try {
      // Build messages
      const messages = this.buildMessages(input);
      
      // Get system prompt in correct language
      const systemPrompt = this.getSystemPrompt(context.language);
      
      // Call Claude
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
      });
      
      // Extract text response
      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent?.text || '';
      
      // Parse structured output
      const parsed = this.parseOutput(responseText, context);
      
      // Build output
      const output: AgentOutput = {
        agentId: this.config.id,
        role: this.config.role,
        team: this.config.team,
        success: true,
        content: responseText,
        confidence: parsed.confidence || 0.8,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        processingTimeMs: Date.now() - startTime,
        timestamp: now(),
        ...parsed,
      };
      
      logger.info('Agent completed', {
        agentId: this.config.id,
        tokensUsed: output.tokensUsed,
        processingTimeMs: output.processingTimeMs,
      });
      
      return output;
      
    } catch (error) {
      logger.error('Agent execution failed', {
        agentId: this.config.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        agentId: this.config.id,
        role: this.config.role,
        team: this.config.team,
        success: false,
        content: '',
        confidence: 0,
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        timestamp: now(),
      };
    }
  }
  
  // ========================================
  // MESSAGE BUILDING
  // ========================================
  
  protected buildMessages(input: AgentInput): Anthropic.MessageParam[] {
    const { context, userMessage, taskDescription, constraints } = input;
    const messages: Anthropic.MessageParam[] = [];
    
    // Add context summary
    const contextSummary = this.buildContextSummary(context);
    messages.push({
      role: 'user',
      content: `## Current Case Context\n${contextSummary}`,
    });
    
    messages.push({
      role: 'assistant',
      content: 'I understand the case context. I will analyze this as the ' + 
               `${this.config.name} and provide my assessment.`,
    });
    
    // Add task description if provided
    if (taskDescription) {
      messages.push({
        role: 'user',
        content: `## Task\n${taskDescription}` + 
                 (constraints ? `\n\n## Constraints\n${constraints.join('\n')}` : ''),
      });
    }
    
    // Add user message if provided
    if (userMessage) {
      messages.push({
        role: 'user',
        content: `## Patient Statement\n"${userMessage}"`,
      });
    }
    
    return messages;
  }
  
  protected buildContextSummary(context: AgentContext): string {
    const { caseState } = context;
    const parts: string[] = [];
    
    // Demographics
    if (caseState.patient_demographics) {
      const demo = caseState.patient_demographics as Record<string, unknown>;
      if (demo.age) parts.push(`Age: ${demo.age} ${demo.age_unit || 'years'}`);
      if (demo.sex) parts.push(`Sex: ${demo.sex}`);
      if (demo.pregnant) parts.push('Pregnant: Yes');
    }
    
    // Chief complaint
    if (caseState.chief_complaint) {
      parts.push(`Chief Complaint: ${caseState.chief_complaint}`);
    }
    
    // Symptoms
    if (caseState.symptom_entities?.length > 0) {
      const symptoms = caseState.symptom_entities.map(s => s.symptom).join(', ');
      parts.push(`Symptoms: ${symptoms}`);
    }
    
    // Medical history
    if (caseState.medical_history && caseState.medical_history.length > 0) {
      parts.push(`PMH: ${caseState.medical_history.join(', ')}`);
    }

    // Medications
    if (caseState.medications && caseState.medications.length > 0) {
      const meds = caseState.medications.map(m => m.name).join(', ');
      parts.push(`Medications: ${meds}`);
    }

    // Allergies
    if (caseState.allergies && caseState.allergies.length > 0) {
      const allergies = caseState.allergies.map(a => a.allergen).join(', ');
      parts.push(`Allergies: ${allergies}`);
    }
    
    // Red flags
    if (caseState.red_flags?.length > 0) {
      const flags = caseState.red_flags.map(f => f.description).join('; ');
      parts.push(`⚠️ Red Flags: ${flags}`);
    }
    
    // Previous agent outputs
    if (context.previousOutputs.size > 0) {
      parts.push('\n## Previous Agent Assessments');
      for (const [agentId, output] of context.previousOutputs) {
        if (output.structuredOutput) {
          parts.push(`${agentId}: ${JSON.stringify(output.structuredOutput)}`);
        }
      }
    }
    
    return parts.join('\n');
  }
  
  // ========================================
  // UTILITY METHODS
  // ========================================
  
  get id(): string {
    return this.config.id;
  }
  
  get role(): string {
    return this.config.role;
  }
  
  get team(): string {
    return this.config.team;
  }

  isActiveInPhase(phase: string): boolean {
    if (!this.config.requiredPhases) return true;
    return this.config.requiredPhases.includes(phase as Phase);
  }
}

// Re-export Phase type for the isActiveInPhase method
import type { Phase } from '../types/index.js';
