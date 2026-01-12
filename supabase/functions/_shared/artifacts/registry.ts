// supabase/functions/_shared/artifacts/registry.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  Artifact,
  ArtifactProvenance,
  CreateArtifactInput,
  ArtifactResult
} from "./types.ts";

const STORAGE_BUCKET = "artifacts";

export async function createArtifact(
  supabase: SupabaseClient,
  input: CreateArtifactInput
): Promise<ArtifactResult> {
  // Convert content to Uint8Array if string
  const contentBytes = typeof input.content === 'string'
    ? new TextEncoder().encode(input.content)
    : input.content;

  // Generate content hash (SHA-256)
  const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Check for existing artifact (deduplication)
  const { data: existing } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', contentHash)
    .single();

  if (existing) {
    // Add provenance for this usage
    await addProvenance(supabase, {
      artifact_id: contentHash,
      run_id: input.run_id,
      step_id: input.step_id,
      tool_name: input.tool_name,
      parent_artifacts: input.parent_artifacts || [],
      created_at: new Date().toISOString()
    });

    return { artifact: existing as Artifact, is_duplicate: true };
  }

  // Upload to storage
  const storagePath = `${input.run_id}/${contentHash}/${input.file_name}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, contentBytes, {
      contentType: input.mime_type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload artifact: ${uploadError.message}`);
  }

  // Create artifact record
  const artifact: Artifact = {
    id: contentHash,
    type: input.type,
    mime_type: input.mime_type,
    file_name: input.file_name,
    file_size_bytes: contentBytes.length,
    storage_path: storagePath,
    created_at: new Date().toISOString(),
    created_by_run_id: input.run_id,
    created_by_step_id: input.step_id,
    created_by_tool: input.tool_name,
    metadata: input.metadata || {}
  };

  const { error: insertError } = await supabase
    .from('artifacts')
    .insert(artifact);

  if (insertError) {
    // Cleanup uploaded file on failure
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Failed to create artifact record: ${insertError.message}`);
  }

  // Add provenance
  await addProvenance(supabase, {
    artifact_id: contentHash,
    run_id: input.run_id,
    step_id: input.step_id,
    tool_name: input.tool_name,
    parent_artifacts: input.parent_artifacts || [],
    created_at: new Date().toISOString()
  });

  return { artifact, is_duplicate: false };
}

export async function getArtifact(
  supabase: SupabaseClient,
  artifactId: string
): Promise<Artifact | null> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single();

  if (error || !data) return null;
  return data as Artifact;
}

export async function getArtifactContent(
  supabase: SupabaseClient,
  artifact: Artifact
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(artifact.storage_path);

  if (error || !data) {
    throw new Error(`Failed to download artifact: ${error?.message}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}

export async function getArtifactUrl(
  supabase: SupabaseClient,
  artifact: Artifact,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(artifact.storage_path, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

export async function listRunArtifacts(
  supabase: SupabaseClient,
  runId: string
): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('created_by_run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list artifacts: ${error.message}`);
  }

  return (data || []) as Artifact[];
}

export async function getArtifactProvenance(
  supabase: SupabaseClient,
  artifactId: string
): Promise<ArtifactProvenance[]> {
  const { data, error } = await supabase
    .from('artifact_provenance')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get provenance: ${error.message}`);
  }

  return (data || []) as ArtifactProvenance[];
}

async function addProvenance(
  supabase: SupabaseClient,
  provenance: ArtifactProvenance
): Promise<void> {
  const { error } = await supabase
    .from('artifact_provenance')
    .insert(provenance);

  if (error) {
    console.error('Failed to add provenance:', error);
  }
}

// Garbage collection - delete unreferenced artifacts older than retention period
export async function garbageCollect(
  supabase: SupabaseClient,
  retentionDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Find artifacts with no recent provenance
  const { data: staleArtifacts, error } = await supabase
    .from('artifacts')
    .select('id, storage_path')
    .lt('created_at', cutoffDate.toISOString())
    .not('id', 'in',
      supabase
        .from('artifact_provenance')
        .select('artifact_id')
        .gte('created_at', cutoffDate.toISOString())
    );

  if (error || !staleArtifacts || staleArtifacts.length === 0) {
    return 0;
  }

  // Delete from storage
  const storagePaths = staleArtifacts.map(a => a.storage_path);
  await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);

  // Delete records
  const artifactIds = staleArtifacts.map(a => a.id);
  await supabase.from('artifact_provenance').delete().in('artifact_id', artifactIds);
  await supabase.from('artifacts').delete().in('id', artifactIds);

  return staleArtifacts.length;
}
