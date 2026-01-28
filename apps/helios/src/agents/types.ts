/**
 * HELIOS Agent System Types
 * Defines agent interfaces and team structure
 */

import type { SupportedLanguage } from '../config/languages.js';
import type { CaseState, Phase, RedFlag, Hypothesis, SymptomEntity } from '../types/index.js';
import type { ConsensusResult } from '../knowledge/types.js';

// ============================================
// AGENT ROLES
// ============================================

export type AgentTeam = 
  | 'history'        // History taking team
  | 'triage'         // Triage & acuity
  | 'differential'   // Differential diagnosis
  | 'plan'           // Treatment planning
  | 'red_flags'      // Safety monitoring
  | 'booking'        // Appointment scheduling
  | 'documentation'; // Clinical documentation

export type AgentRole = 
  // History Team
  | 'chief_complaint_extractor'
  | 'hpi_gatherer'
  | 'pmh_collector'
  | 'medication_reviewer'
  | 'allergy_checker'
  | 'social_history_gatherer'
  | 'family_history_collector'
  | 'ros_reviewer'
  // Triage Team
  | 'esi_calculator'
  | 'acuity_assessor'
  | 'resource_estimator'
  | 'disposition_recommender'
  // Differential Team
  | 'hypothesis_generator'
  | 'evidence_weigher'
  | 'must_not_miss_checker'
  | 'consensus_builder'
  // Plan Team
  | 'workup_planner'
  | 'referral_recommender'
  | 'patient_educator'
  // Red Flags Team
  | 'cardiac_monitor'
  | 'neuro_monitor'
  | 'respiratory_monitor'
  | 'psychiatric_monitor'
  | 'pediatric_monitor'
  // Booking Team
  | 'provider_matcher'
  | 'availability_checker'
  | 'appointment_scheduler'
  // Documentation Team
  | 'soap_writer'
  | 'summary_generator'
  | 'handoff_creator';

// ============================================
// AGENT CONFIGURATION
// ============================================

export interface AgentConfig {
  id: string;
  role: AgentRole;
  team: AgentTeam;
  name: string;
  description: string;
  model: string;  // Claude model to use
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  tools?: AgentTool[];
  requiredPhases?: Phase[];  // Phases where agent is active
  priority: number;  // Execution priority within team
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, context: AgentContext) => Promise<unknown>;
}

// ============================================
// AGENT EXECUTION
// ============================================

export interface AgentContext {
  sessionId: string;
  caseState: CaseState;
  language: SupportedLanguage;
  currentPhase: Phase;
  previousOutputs: Map<string, AgentOutput>;
  knowledgeResults?: ConsensusResult;
}

export interface AgentInput {
  context: AgentContext;
  userMessage?: string;
  taskDescription?: string;
  constraints?: string[];
}

export interface AgentOutput {
  agentId: string;
  role: AgentRole;
  team: AgentTeam;
  success: boolean;
  
  // Content
  content: string;
  structuredOutput?: Record<string, unknown>;
  
  // Extracted data
  extractedSymptoms?: SymptomEntity[];
  extractedHypotheses?: Hypothesis[];
  extractedRedFlags?: RedFlag[];
  
  // Recommendations
  recommendedPhase?: Phase;
  recommendedActions?: string[];
  questionsToAsk?: string[];
  
  // Confidence
  confidence: number;
  reasoning?: string;
  
  // Metadata
  tokensUsed: number;
  processingTimeMs: number;
  timestamp: string;
}

// ============================================
// TEAM COORDINATION
// ============================================

export interface TeamOutput {
  team: AgentTeam;
  phase: Phase;
  agentOutputs: AgentOutput[];
  consensus?: TeamConsensus;
  finalRecommendation: string;
  confidence: number;
}

export interface TeamConsensus {
  achieved: boolean;
  score: number;
  agreementMap: Map<string, number>;  // topic -> agreement %
  conflicts: ConflictResolution[];
}

export interface ConflictResolution {
  topic: string;
  positions: Array<{
    agentId: string;
    position: string;
    confidence: number;
  }>;
  resolution: string;
  resolvedBy: 'majority' | 'highest_confidence' | 'supervisor' | 'safety_override';
}

// ============================================
// ORCHESTRATOR TYPES
// ============================================

export interface OrchestratorConfig {
  maxIterations: number;
  consensusThreshold: number;
  timeoutMs: number;
  parallelExecution: boolean;
}

export interface OrchestratorResult {
  sessionId: string;
  finalPhase: Phase;
  teamOutputs: TeamOutput[];
  finalResponse: string;
  redFlags: RedFlag[];
  escalated: boolean;
  totalTokensUsed: number;
  totalProcessingTimeMs: number;
}
