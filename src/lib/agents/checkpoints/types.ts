import type { TodoPlan } from '../planning';

export type CheckpointType = 'auto' | 'phase_complete' | 'pre_dangerous' | 'user_pause' | 'completion';

export interface FileState {
  path: string;
  content?: string;
  hash?: string;
  action: 'created' | 'modified' | 'deleted';
}

export interface ToolExecution {
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: Date;
  duration: number;
  status: 'success' | 'error';
}

export interface AgentContextState {
  currentStep: number;
  totalSteps: number;
  variables: Record<string, unknown>;
  errors: string[];
}

export interface CheckpointState {
  plan: TodoPlan;
  files: FileState[];
  context: AgentContextState;
  toolHistory: ToolExecution[];
}

export interface CheckpointMetadata {
  phaseCompleted: number;
  tasksCompleted: number;
  tokensUsed: number;
  duration: number;
  checkpointReason?: string;
}

export interface Checkpoint {
  id: string;
  taskId: string;
  userId: string;
  type: CheckpointType;
  state: CheckpointState;
  metadata: CheckpointMetadata;
  createdAt: Date;
  expiresAt: Date;
}

export interface CheckpointSummary {
  id: string;
  taskId: string;
  type: CheckpointType;
  phaseCompleted: number;
  tasksCompleted: number;
  createdAt: Date;
}
