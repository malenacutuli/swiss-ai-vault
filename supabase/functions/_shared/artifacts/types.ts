// supabase/functions/_shared/artifacts/types.ts

export type ArtifactType = 'file' | 'image' | 'document' | 'code' | 'data' | 'model' | 'other';

export interface Artifact {
  id: string;  // SHA-256 content hash
  type: ArtifactType;
  mime_type: string;
  file_name: string;
  file_size_bytes: number;
  storage_path: string;
  created_at: string;
  created_by_run_id: string;
  created_by_step_id: string;
  created_by_tool: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactProvenance {
  artifact_id: string;
  run_id: string;
  step_id: string;
  tool_name: string;
  parent_artifacts: string[];
  created_at: string;
}

export interface CreateArtifactInput {
  content: Uint8Array | string;
  type: ArtifactType;
  mime_type: string;
  file_name: string;
  run_id: string;
  step_id: string;
  tool_name: string;
  parent_artifacts?: string[];
  metadata?: Record<string, unknown>;
}

export interface ArtifactResult {
  artifact: Artifact;
  is_duplicate: boolean;
}
