export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      action_templates: {
        Row: {
          avg_rating: number | null
          category: string | null
          complexity: string | null
          created_at: string | null
          created_by: string | null
          default_values: Json | null
          description: string | null
          estimated_duration_seconds: number | null
          example_inputs: Json | null
          icon: string | null
          id: string
          is_featured: boolean | null
          is_public: boolean | null
          name: string
          output_schema: Json | null
          output_types: Json | null
          prompt_template: string
          required_inputs: Json | null
          required_tools: Json | null
          requires_code_sandbox: boolean | null
          requires_notebooklm: boolean | null
          system_prompt: string | null
          tool_permissions: Json | null
          updated_at: string | null
          usage_count: number | null
          vertical: string | null
        }
        Insert: {
          avg_rating?: number | null
          category?: string | null
          complexity?: string | null
          created_at?: string | null
          created_by?: string | null
          default_values?: Json | null
          description?: string | null
          estimated_duration_seconds?: number | null
          example_inputs?: Json | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          name: string
          output_schema?: Json | null
          output_types?: Json | null
          prompt_template: string
          required_inputs?: Json | null
          required_tools?: Json | null
          requires_code_sandbox?: boolean | null
          requires_notebooklm?: boolean | null
          system_prompt?: string | null
          tool_permissions?: Json | null
          updated_at?: string | null
          usage_count?: number | null
          vertical?: string | null
        }
        Update: {
          avg_rating?: number | null
          category?: string | null
          complexity?: string | null
          created_at?: string | null
          created_by?: string | null
          default_values?: Json | null
          description?: string | null
          estimated_duration_seconds?: number | null
          example_inputs?: Json | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          name?: string
          output_schema?: Json | null
          output_types?: Json | null
          prompt_template?: string
          required_inputs?: Json | null
          required_tools?: Json | null
          requires_code_sandbox?: boolean | null
          requires_notebooklm?: boolean | null
          system_prompt?: string | null
          tool_permissions?: Json | null
          updated_at?: string | null
          usage_count?: number | null
          vertical?: string | null
        }
        Relationships: []
      }
      agent_communications: {
        Row: {
          attachments: Json | null
          created_at: string | null
          from_agent: string
          id: string
          message_content: string
          message_type: string
          task_id: string | null
          to_agent: string
          tokens_used: number | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          from_agent: string
          id?: string
          message_content: string
          message_type: string
          task_id?: string | null
          to_agent: string
          tokens_used?: number | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          from_agent?: string
          id?: string
          message_content?: string
          message_type?: string
          task_id?: string | null
          to_agent?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_communications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_file_actions: {
        Row: {
          action_type: string
          created_at: string | null
          file_content: string | null
          file_path: string
          id: string
          metadata: Json | null
          step_id: string | null
          storage_url: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          file_content?: string | null
          file_path: string
          id?: string
          metadata?: Json | null
          step_id?: string | null
          storage_url?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          file_content?: string | null
          file_path?: string
          id?: string
          metadata?: Json | null
          step_id?: string | null
          storage_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_file_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "agent_task_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory_context: {
        Row: {
          context_content: string
          context_type: string
          created_at: string | null
          id: string
          relevance_score: number | null
          source_reference: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          context_content: string
          context_type: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          source_reference?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          context_content?: string
          context_type?: string
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          source_reference?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_context_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_notebook_sources: {
        Row: {
          content_summary: string | null
          created_at: string | null
          embeddings: string | null
          full_text: string | null
          id: string
          metadata: Json | null
          source_name: string | null
          source_type: string | null
          source_url: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          content_summary?: string | null
          created_at?: string | null
          embeddings?: string | null
          full_text?: string | null
          id?: string
          metadata?: Json | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_summary?: string | null
          created_at?: string | null
          embeddings?: string | null
          full_text?: string | null
          id?: string
          metadata?: Json | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_notebook_sources_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_outputs: {
        Row: {
          actual_format: string | null
          conversion_status: string | null
          created_at: string | null
          download_url: string | null
          encryption_key_id: string | null
          expires_at: string | null
          file_name: string
          file_path: string | null
          file_size_bytes: number | null
          id: string
          is_encrypted: boolean | null
          mime_type: string | null
          notebooklm_source_id: string | null
          output_type: string
          preview_url: string | null
          requested_format: string | null
          storage_bucket: string | null
          storage_region: string | null
          task_id: string
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          actual_format?: string | null
          conversion_status?: string | null
          created_at?: string | null
          download_url?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          file_name: string
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_encrypted?: boolean | null
          mime_type?: string | null
          notebooklm_source_id?: string | null
          output_type: string
          preview_url?: string | null
          requested_format?: string | null
          storage_bucket?: string | null
          storage_region?: string | null
          task_id: string
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          actual_format?: string | null
          conversion_status?: string | null
          created_at?: string | null
          download_url?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          file_name?: string
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_encrypted?: boolean | null
          mime_type?: string | null
          notebooklm_source_id?: string | null
          output_type?: string
          preview_url?: string | null
          requested_format?: string | null
          storage_bucket?: string | null
          storage_region?: string | null
          task_id?: string
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reasoning: {
        Row: {
          agent_type: string
          alternatives_considered: Json | null
          confidence_score: number | null
          created_at: string | null
          decisions_made: Json | null
          id: string
          model_used: string | null
          reasoning_text: string
          sources_used: Json | null
          step_id: string | null
          task_id: string | null
          thinking_duration_ms: number | null
        }
        Insert: {
          agent_type: string
          alternatives_considered?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          decisions_made?: Json | null
          id?: string
          model_used?: string | null
          reasoning_text: string
          sources_used?: Json | null
          step_id?: string | null
          task_id?: string | null
          thinking_duration_ms?: number | null
        }
        Update: {
          agent_type?: string
          alternatives_considered?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          decisions_made?: Json | null
          id?: string
          model_used?: string | null
          reasoning_text?: string
          sources_used?: Json | null
          step_id?: string | null
          task_id?: string | null
          thinking_duration_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_reasoning_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "agent_task_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reasoning_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          browser_url: string | null
          cpu_seconds: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          memory_mb: number | null
          screenshot_url: string | null
          session_type: string
          started_at: string | null
          status: string | null
          task_id: string | null
          user_id: string
          workspace_path: string | null
        }
        Insert: {
          browser_url?: string | null
          cpu_seconds?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          memory_mb?: number | null
          screenshot_url?: string | null
          session_type: string
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          user_id: string
          workspace_path?: string | null
        }
        Update: {
          browser_url?: string | null
          cpu_seconds?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          memory_mb?: number | null
          screenshot_url?: string | null
          session_type?: string
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string
          workspace_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sources: {
        Row: {
          citation_key: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          page_number: number | null
          relevance_score: number | null
          source_snippet: string | null
          source_title: string | null
          source_type: string
          source_url: string | null
          task_id: string | null
          used_in_step: string | null
        }
        Insert: {
          citation_key?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          relevance_score?: number | null
          source_snippet?: string | null
          source_title?: string | null
          source_type: string
          source_url?: string | null
          task_id?: string | null
          used_in_step?: string | null
        }
        Update: {
          citation_key?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          relevance_score?: number | null
          source_snippet?: string | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          task_id?: string | null
          used_in_step?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sources_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sources_used_in_step_fkey"
            columns: ["used_in_step"]
            isOneToOne: false
            referencedRelation: "agent_task_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_study_materials: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          material_type: string | null
          task_id: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          material_type?: string | null
          task_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          material_type?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_study_materials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_suggestions: {
        Row: {
          created_at: string | null
          id: string
          priority: number | null
          suggestion_text: string
          suggestion_type: string | null
          task_id: string | null
          was_used: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          priority?: number | null
          suggestion_text: string
          suggestion_type?: string | null
          task_id?: string | null
          was_used?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          priority?: number | null
          suggestion_text?: string
          suggestion_type?: string | null
          task_id?: string | null
          was_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_suggestions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_task_logs: {
        Row: {
          content: string
          id: string
          log_type: string | null
          sequence_number: number | null
          task_id: string | null
          timestamp: string | null
        }
        Insert: {
          content: string
          id?: string
          log_type?: string | null
          sequence_number?: number | null
          task_id?: string | null
          timestamp?: string | null
        }
        Update: {
          content?: string
          id?: string
          log_type?: string | null
          sequence_number?: number | null
          task_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_task_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_task_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_action: string | null
          description: string | null
          duration_ms: number | null
          error_message: string | null
          file_actions: Json | null
          id: string
          retry_count: number | null
          started_at: string | null
          status: string | null
          step_number: number
          step_type: string
          task_id: string
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_action?: string | null
          description?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_actions?: Json | null
          id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          step_number: number
          step_type: string
          task_id: string
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_action?: string | null
          description?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_actions?: Json | null
          id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          step_number?: number
          step_type?: string
          task_id?: string
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_task_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          credits_used: number | null
          current_step: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          is_shared: boolean | null
          knowledge_sources: Json | null
          mode: string | null
          model_id: string | null
          model_used: string | null
          notebooklm_notebook_id: string | null
          output_format: string | null
          plan_json: Json | null
          plan_summary: string | null
          privacy_tier: string | null
          progress_percentage: number | null
          prompt: string
          reasoning_visible: boolean | null
          requested_format: string | null
          result_summary: string | null
          share_token: string | null
          started_at: string | null
          status: string | null
          task_type: string | null
          tokens_used: number | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
          user_rating: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          current_step?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          is_shared?: boolean | null
          knowledge_sources?: Json | null
          mode?: string | null
          model_id?: string | null
          model_used?: string | null
          notebooklm_notebook_id?: string | null
          output_format?: string | null
          plan_json?: Json | null
          plan_summary?: string | null
          privacy_tier?: string | null
          progress_percentage?: number | null
          prompt: string
          reasoning_visible?: boolean | null
          requested_format?: string | null
          result_summary?: string | null
          share_token?: string | null
          started_at?: string | null
          status?: string | null
          task_type?: string | null
          tokens_used?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
          user_rating?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          current_step?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          is_shared?: boolean | null
          knowledge_sources?: Json | null
          mode?: string | null
          model_id?: string | null
          model_used?: string | null
          notebooklm_notebook_id?: string | null
          output_format?: string | null
          plan_json?: Json | null
          plan_summary?: string | null
          privacy_tier?: string | null
          progress_percentage?: number | null
          prompt?: string
          reasoning_visible?: boolean | null
          requested_format?: string | null
          result_summary?: string | null
          share_token?: string | null
          started_at?: string | null
          status?: string | null
          task_type?: string | null
          tokens_used?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
          user_rating?: number | null
        }
        Relationships: []
      }
      agent_tool_calls: {
        Row: {
          completed_at: string | null
          created_at: string | null
          credits_charged: number | null
          duration_ms: number | null
          error_code: string | null
          id: string
          input_hash: string | null
          input_size_bytes: number | null
          output_size_bytes: number | null
          started_at: string
          status: string
          step_id: string | null
          task_id: string
          tokens_used: number | null
          tool_name: string
          tool_version: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          input_hash?: string | null
          input_size_bytes?: number | null
          output_size_bytes?: number | null
          started_at: string
          status: string
          step_id?: string | null
          task_id: string
          tokens_used?: number | null
          tool_name: string
          tool_version?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          input_hash?: string | null
          input_size_bytes?: number | null
          output_size_bytes?: number | null
          started_at?: string
          status?: string
          step_id?: string | null
          task_id?: string
          tokens_used?: number | null
          tool_name?: string
          tool_version?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_calls_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "agent_task_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tool_calls_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      anonymous_usage: {
        Row: {
          block_reason: string | null
          created_at: string | null
          daily_images_used: number | null
          daily_prompts_used: number | null
          daily_research_used: number | null
          daily_reset_at: string | null
          daily_videos_used: number | null
          fingerprint_hash: string | null
          first_seen_at: string | null
          id: string
          ip_hash: string
          is_blocked: boolean | null
          last_seen_at: string | null
          max_daily_images: number | null
          max_daily_prompts: number | null
          max_daily_research: number | null
          max_daily_videos: number | null
          total_prompts_lifetime: number | null
          updated_at: string | null
        }
        Insert: {
          block_reason?: string | null
          created_at?: string | null
          daily_images_used?: number | null
          daily_prompts_used?: number | null
          daily_research_used?: number | null
          daily_reset_at?: string | null
          daily_videos_used?: number | null
          fingerprint_hash?: string | null
          first_seen_at?: string | null
          id?: string
          ip_hash: string
          is_blocked?: boolean | null
          last_seen_at?: string | null
          max_daily_images?: number | null
          max_daily_prompts?: number | null
          max_daily_research?: number | null
          max_daily_videos?: number | null
          total_prompts_lifetime?: number | null
          updated_at?: string | null
        }
        Update: {
          block_reason?: string | null
          created_at?: string | null
          daily_images_used?: number | null
          daily_prompts_used?: number | null
          daily_research_used?: number | null
          daily_reset_at?: string | null
          daily_videos_used?: number | null
          fingerprint_hash?: string | null
          first_seen_at?: string | null
          id?: string
          ip_hash?: string
          is_blocked?: boolean | null
          last_seen_at?: string | null
          max_daily_images?: number | null
          max_daily_prompts?: number | null
          max_daily_research?: number | null
          max_daily_videos?: number | null
          total_prompts_lifetime?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_key_usage: {
        Row: {
          api_key_id: string
          created_at: string | null
          endpoint: string | null
          id: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json | null
          rate_limit: number | null
          rate_limit_tier: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          rate_limit?: number | null
          rate_limit_tier?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          rate_limit?: number | null
          rate_limit_tier?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          request_body: Json | null
          resource_id: string | null
          resource_type: string | null
          response_status: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          request_body?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          response_status?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          request_body?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          response_status?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      base_models: {
        Row: {
          category: string | null
          context_length: number | null
          created_at: string | null
          description: string | null
          id: string
          input_price: number | null
          is_active: boolean | null
          is_finetunable: boolean | null
          license_type: string | null
          model_type: string | null
          name: string
          output_price: number | null
          parameters: string | null
          provider: string
          supports_images: boolean | null
          supports_vision: boolean | null
        }
        Insert: {
          category?: string | null
          context_length?: number | null
          created_at?: string | null
          description?: string | null
          id: string
          input_price?: number | null
          is_active?: boolean | null
          is_finetunable?: boolean | null
          license_type?: string | null
          model_type?: string | null
          name: string
          output_price?: number | null
          parameters?: string | null
          provider: string
          supports_images?: boolean | null
          supports_vision?: boolean | null
        }
        Update: {
          category?: string | null
          context_length?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          input_price?: number | null
          is_active?: boolean | null
          is_finetunable?: boolean | null
          license_type?: string | null
          model_type?: string | null
          name?: string
          output_price?: number | null
          parameters?: string | null
          provider?: string
          supports_images?: boolean | null
          supports_vision?: boolean | null
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          email: string
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          email: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          email?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string
          paid_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_stripe_customer_id_fkey"
            columns: ["stripe_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["stripe_customer_id"]
          },
        ]
      }
      browser_actions: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string | null
          id: string
          result: Json | null
          screenshot_url: string | null
          session_id: string | null
        }
        Insert: {
          action_data: Json
          action_type: string
          created_at?: string | null
          id?: string
          result?: Json | null
          screenshot_url?: string | null
          session_id?: string | null
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string | null
          id?: string
          result?: Json | null
          screenshot_url?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "browser_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "browser_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_sessions: {
        Row: {
          closed_at: string | null
          created_at: string | null
          current_url: string | null
          id: string
          last_action_at: string | null
          session_token: string | null
          status: string | null
          task_id: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          current_url?: string | null
          id?: string
          last_action_at?: string | null
          session_token?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          current_url?: string | null
          id?: string
          last_action_at?: string | null
          session_token?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "browser_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          conversation_id: string
          created_at: string | null
          encrypted_preview: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          message_id: string | null
          storage_path: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          encrypted_preview?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          message_id?: string | null
          storage_path: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          encrypted_preview?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          message_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          encryption_key_hash: string
          id: string
          is_encrypted: boolean | null
          is_shared: boolean | null
          last_message_at: string | null
          message_count: number | null
          model_id: string
          organization_id: string | null
          share_token: string | null
          system_prompt: string | null
          title: string
          total_tokens: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_hash: string
          id?: string
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          model_id: string
          organization_id?: string | null
          share_token?: string | null
          system_prompt?: string | null
          title?: string
          total_tokens?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_hash?: string
          id?: string
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          model_id?: string
          organization_id?: string | null
          share_token?: string | null
          system_prompt?: string | null
          title?: string
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_integration_data: {
        Row: {
          data_type: string
          encrypted_content: string | null
          external_id: string
          id: string
          integration_id: string
          metadata: Json | null
          snippet: string | null
          synced_at: string | null
          title: string | null
        }
        Insert: {
          data_type: string
          encrypted_content?: string | null
          external_id: string
          id?: string
          integration_id: string
          metadata?: Json | null
          snippet?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          data_type?: string
          encrypted_content?: string | null
          external_id?: string
          id?: string
          integration_id?: string
          metadata?: Json | null
          snippet?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_integration_data_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "chat_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_integrations: {
        Row: {
          created_at: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          id: string
          integration_name: string
          integration_type: string
          is_active: boolean | null
          last_synced_at: string | null
          metadata: Json | null
          organization_id: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          id?: string
          integration_name: string
          integration_type: string
          is_active?: boolean | null
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          id?: string
          integration_name?: string
          integration_type?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          credits_used: number | null
          encrypted_content: string
          finish_reason: string | null
          has_attachments: boolean | null
          id: string
          latency_ms: number | null
          model_used: string | null
          role: string
          token_count: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          credits_used?: number | null
          encrypted_content: string
          finish_reason?: string | null
          has_attachments?: boolean | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role: string
          token_count?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          credits_used?: number | null
          encrypted_content?: string
          finish_reason?: string | null
          has_attachments?: boolean | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_shared_conversations: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          permission: string
          shared_by_user_id: string | null
          shared_with_user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          permission?: string
          shared_by_user_id?: string | null
          shared_with_user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          permission?: string
          shared_by_user_id?: string | null
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_shared_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      code_executions: {
        Row: {
          code: string
          created_at: string | null
          execution_time_ms: number | null
          exit_code: number | null
          id: string
          language: string
          memory_used_mb: number | null
          sandbox_id: string | null
          stderr: string | null
          stdin: string | null
          stdout: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          execution_time_ms?: number | null
          exit_code?: number | null
          id?: string
          language: string
          memory_used_mb?: number | null
          sandbox_id?: string | null
          stderr?: string | null
          stdin?: string | null
          stdout?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          execution_time_ms?: number | null
          exit_code?: number | null
          id?: string
          language?: string
          memory_used_mb?: number | null
          sandbox_id?: string | null
          stderr?: string | null
          stdin?: string | null
          stdout?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_executions_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "code_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      code_sandboxes: {
        Row: {
          container_id: string | null
          created_at: string | null
          destroyed_at: string | null
          environment: string
          expires_at: string | null
          files: Json | null
          id: string
          installed_packages: Json | null
          status: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string | null
          destroyed_at?: string | null
          environment: string
          expires_at?: string | null
          files?: Json | null
          id?: string
          installed_packages?: Json | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string | null
          destroyed_at?: string | null
          environment?: string
          expires_at?: string | null
          files?: Json | null
          id?: string
          installed_packages?: Json | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_sandboxes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_participants: {
        Row: {
          id: string
          joined_at: string | null
          left_at: string | null
          role: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "collab_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          id: string
          settings: Json | null
          status: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          settings?: Json | null
          status?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          settings?: Json | null
          status?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_keys: {
        Row: {
          algorithm: string | null
          conversation_id: string
          created_at: string | null
          id: string
          key_version: number | null
          rotated_at: string | null
          user_id: string
          wrapped_key: string
          wrapping_nonce: string
        }
        Insert: {
          algorithm?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          key_version?: number | null
          rotated_at?: string | null
          user_id: string
          wrapped_key: string
          wrapping_nonce: string
        }
        Update: {
          algorithm?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          key_version?: number | null
          rotated_at?: string | null
          user_id?: string
          wrapped_key?: string
          wrapping_nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_keys_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "encrypted_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          created_at: string
          credits_used: number
          description: string | null
          id: string
          metadata: Json | null
          service_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          service_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          service_type?: string
          user_id?: string
        }
        Relationships: []
      }
      dataset_snapshots: {
        Row: {
          created_at: string | null
          dataset_id: string
          id: string
          name: string
          row_count: number
          s3_path: string
          train_row_count: number | null
          train_split_pct: number | null
          val_row_count: number | null
          version: number
        }
        Insert: {
          created_at?: string | null
          dataset_id: string
          id?: string
          name: string
          row_count: number
          s3_path: string
          train_row_count?: number | null
          train_split_pct?: number | null
          val_row_count?: number | null
          version?: number
        }
        Update: {
          created_at?: string | null
          dataset_id?: string
          id?: string
          name?: string
          row_count?: number
          s3_path?: string
          train_row_count?: number | null
          train_split_pct?: number | null
          val_row_count?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataset_snapshots_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          avg_conversation_length: number | null
          created_at: string | null
          description: string | null
          error_message: string | null
          id: string
          name: string
          project_id: string | null
          quality_metrics: Json | null
          row_count: number | null
          s3_path: string | null
          source_config: Json | null
          source_type: Database["public"]["Enums"]["dataset_source_type"]
          status: Database["public"]["Enums"]["dataset_status"] | null
          total_tokens: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_conversation_length?: number | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          name: string
          project_id?: string | null
          quality_metrics?: Json | null
          row_count?: number | null
          s3_path?: string | null
          source_config?: Json | null
          source_type?: Database["public"]["Enums"]["dataset_source_type"]
          status?: Database["public"]["Enums"]["dataset_status"] | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_conversation_length?: number | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          name?: string
          project_id?: string | null
          quality_metrics?: Json | null
          row_count?: number | null
          s3_path?: string | null
          source_config?: Json | null
          source_type?: Database["public"]["Enums"]["dataset_source_type"]
          status?: Database["public"]["Enums"]["dataset_status"] | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          config: Json | null
          created_at: string | null
          deployment_type: string | null
          endpoint_url: string | null
          gpu_type: string | null
          id: string
          model_id: string
          replicas: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          deployment_type?: string | null
          endpoint_url?: string | null
          gpu_type?: string | null
          id?: string
          model_id: string
          replicas?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          deployment_type?: string | null
          endpoint_url?: string | null
          gpu_type?: string | null
          id?: string
          model_id?: string
          replicas?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          conversation_id: string | null
          created_at: string | null
          embedding: string | null
          file_type: string | null
          filename: string
          id: string
          metadata: Json | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          file_type?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: string | null
          file_type?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      document_processing_jobs: {
        Row: {
          chunks_created: number | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          handler: string
          id: string
          processing_time_ms: number | null
          progress: number | null
          started_at: string | null
          status: string | null
          storage_path: string | null
          user_id: string
        }
        Insert: {
          chunks_created?: number | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_size: number
          file_type: string
          handler: string
          id?: string
          processing_time_ms?: number | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          user_id: string
        }
        Update: {
          chunks_created?: number | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          handler?: string
          id?: string
          processing_time_ms?: number | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "encrypted_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_conversations: {
        Row: {
          created_at: string | null
          encrypted_title: string | null
          expires_at: string | null
          id: string
          is_encrypted: boolean | null
          key_hash: string
          key_version: number | null
          last_message_at: string | null
          model_id: string
          organization_id: string | null
          retention_mode: string | null
          title_nonce: string
          updated_at: string | null
          user_id: string
          zero_retention: boolean | null
        }
        Insert: {
          created_at?: string | null
          encrypted_title?: string | null
          expires_at?: string | null
          id?: string
          is_encrypted?: boolean | null
          key_hash: string
          key_version?: number | null
          last_message_at?: string | null
          model_id?: string
          organization_id?: string | null
          retention_mode?: string | null
          title_nonce: string
          updated_at?: string | null
          user_id: string
          zero_retention?: boolean | null
        }
        Update: {
          created_at?: string | null
          encrypted_title?: string | null
          expires_at?: string | null
          id?: string
          is_encrypted?: boolean | null
          key_hash?: string
          key_version?: number | null
          last_message_at?: string | null
          model_id?: string
          organization_id?: string | null
          retention_mode?: string | null
          title_nonce?: string
          updated_at?: string | null
          user_id?: string
          zero_retention?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_document_chunks: {
        Row: {
          chunk_index: number
          content_nonce: string
          created_at: string | null
          document_id: string
          embedding_nonce: string | null
          encrypted_content: string
          encrypted_embedding: string | null
          id: string
        }
        Insert: {
          chunk_index: number
          content_nonce: string
          created_at?: string | null
          document_id: string
          embedding_nonce?: string | null
          encrypted_content: string
          encrypted_embedding?: string | null
          id?: string
        }
        Update: {
          chunk_index?: number
          content_nonce?: string
          created_at?: string | null
          document_id?: string
          embedding_nonce?: string | null
          encrypted_content?: string
          encrypted_embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "encrypted_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_documents: {
        Row: {
          chunk_count: number | null
          conversation_id: string | null
          created_at: string | null
          encrypted_filename: string
          error_message: string | null
          file_size: number | null
          file_type: string
          filename_nonce: string
          id: string
          key_version: number | null
          processed_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          chunk_count?: number | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_filename: string
          error_message?: string | null
          file_size?: number | null
          file_type: string
          filename_nonce: string
          id?: string
          key_version?: number | null
          processed_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          chunk_count?: number | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_filename?: string
          error_message?: string | null
          file_size?: number | null
          file_type?: string
          filename_nonce?: string
          id?: string
          key_version?: number | null
          processed_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_documents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "encrypted_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_messages: {
        Row: {
          ciphertext: string
          conversation_id: string
          created_at: string | null
          expires_at: string | null
          has_attachments: boolean | null
          id: string
          nonce: string
          role: string
          sequence_number: number
          token_count: number | null
        }
        Insert: {
          ciphertext: string
          conversation_id: string
          created_at?: string | null
          expires_at?: string | null
          has_attachments?: boolean | null
          id?: string
          nonce: string
          role: string
          sequence_number: number
          token_count?: number | null
        }
        Update: {
          ciphertext?: string
          conversation_id?: string
          created_at?: string | null
          expires_at?: string | null
          has_attachments?: boolean | null
          id?: string
          nonce?: string
          role?: string
          sequence_number?: number
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "encrypted_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          byoe_endpoint: string | null
          completed_at: string | null
          created_at: string | null
          detailed_results: Json | null
          error_message: string | null
          id: string
          metric_ids: string[]
          model_id: string
          project_id: string | null
          results: Json | null
          snapshot_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["evaluation_status"] | null
          user_id: string
        }
        Insert: {
          byoe_endpoint?: string | null
          completed_at?: string | null
          created_at?: string | null
          detailed_results?: Json | null
          error_message?: string | null
          id?: string
          metric_ids: string[]
          model_id: string
          project_id?: string | null
          results?: Json | null
          snapshot_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"] | null
          user_id: string
        }
        Update: {
          byoe_endpoint?: string | null
          completed_at?: string | null
          created_at?: string | null
          detailed_results?: Json | null
          error_message?: string | null
          id?: string
          metric_ids?: string[]
          model_id?: string
          project_id?: string | null
          results?: Json | null
          snapshot_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "dataset_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string | null
          final_loss: number | null
          id: string
          job_id: string
          name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["finetuning_status"] | null
          training_loss: Json | null
        }
        Insert: {
          completed_at?: string | null
          config: Json
          created_at?: string | null
          final_loss?: number | null
          id?: string
          job_id: string
          name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["finetuning_status"] | null
          training_loss?: Json | null
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          final_loss?: number | null
          id?: string
          job_id?: string
          name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["finetuning_status"] | null
          training_loss?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "experiments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "finetuning_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      finetuning_jobs: {
        Row: {
          base_model: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          hyperparameters: Json
          id: string
          method: Database["public"]["Enums"]["finetuning_method"] | null
          name: string
          project_id: string | null
          s3_checkpoint_path: string | null
          s3_gguf_path: string | null
          snapshot_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["finetuning_status"] | null
          training_metrics: Json | null
          user_id: string
        }
        Insert: {
          base_model: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          hyperparameters?: Json
          id?: string
          method?: Database["public"]["Enums"]["finetuning_method"] | null
          name: string
          project_id?: string | null
          s3_checkpoint_path?: string | null
          s3_gguf_path?: string | null
          snapshot_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["finetuning_status"] | null
          training_metrics?: Json | null
          user_id: string
        }
        Update: {
          base_model?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          hyperparameters?: Json
          id?: string
          method?: Database["public"]["Enums"]["finetuning_method"] | null
          name?: string
          project_id?: string | null
          s3_checkpoint_path?: string | null
          s3_gguf_path?: string | null
          snapshot_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["finetuning_status"] | null
          training_metrics?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finetuning_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finetuning_jobs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "dataset_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finetuning_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      finetuning_templates: {
        Row: {
          created_at: string | null
          default_hyperparameters: Json | null
          description: string | null
          difficulty: string | null
          domain: string
          estimated_time: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          language: string
          language_code: string
          name: string
          recommended_method: string | null
          recommended_model: string
          sample_conversations: Json | null
          sample_system_prompt: string | null
          slug: string
          use_cases: string[] | null
        }
        Insert: {
          created_at?: string | null
          default_hyperparameters?: Json | null
          description?: string | null
          difficulty?: string | null
          domain: string
          estimated_time?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          language: string
          language_code: string
          name: string
          recommended_method?: string | null
          recommended_model: string
          sample_conversations?: Json | null
          sample_system_prompt?: string | null
          slug: string
          use_cases?: string[] | null
        }
        Update: {
          created_at?: string | null
          default_hyperparameters?: Json | null
          description?: string | null
          difficulty?: string | null
          domain?: string
          estimated_time?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          language?: string
          language_code?: string
          name?: string
          recommended_method?: string | null
          recommended_model?: string
          sample_conversations?: Json | null
          sample_system_prompt?: string | null
          slug?: string
          use_cases?: string[] | null
        }
        Relationships: []
      }
      ghost_api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          monthly_credit_limit: number | null
          name: string
          permissions: string[] | null
          rate_limit_per_minute: number | null
          total_requests: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          monthly_credit_limit?: number | null
          name: string
          permissions?: string[] | null
          rate_limit_per_minute?: number | null
          total_requests?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          monthly_credit_limit?: number | null
          name?: string
          permissions?: string[] | null
          rate_limit_per_minute?: number | null
          total_requests?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ghost_comparison_responses: {
        Row: {
          comparison_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          model_id: string
          rating: number | null
          response: string | null
          status: string | null
          tokens_used: number | null
        }
        Insert: {
          comparison_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model_id: string
          rating?: number | null
          response?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Update: {
          comparison_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model_id?: string
          rating?: number | null
          response?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ghost_comparison_responses_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "ghost_comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_comparisons: {
        Row: {
          created_at: string | null
          id: string
          models: string[]
          prompt: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          models: string[]
          prompt: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          models?: string[]
          prompt?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ghost_credits: {
        Row: {
          balance: number | null
          created_at: string | null
          daily_free_limit: number | null
          daily_free_used: number | null
          daily_reset_at: string | null
          free_credits_remaining: number | null
          id: string
          image_credits_remaining: number | null
          image_daily_limit: number | null
          image_daily_used: number | null
          last_purchase: string | null
          paid_credits_balance: number | null
          updated_at: string | null
          user_id: string
          video_credits_remaining: number | null
          video_daily_limit: number | null
          video_daily_used: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          daily_free_limit?: number | null
          daily_free_used?: number | null
          daily_reset_at?: string | null
          free_credits_remaining?: number | null
          id?: string
          image_credits_remaining?: number | null
          image_daily_limit?: number | null
          image_daily_used?: number | null
          last_purchase?: string | null
          paid_credits_balance?: number | null
          updated_at?: string | null
          user_id: string
          video_credits_remaining?: number | null
          video_daily_limit?: number | null
          video_daily_used?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          daily_free_limit?: number | null
          daily_free_used?: number | null
          daily_reset_at?: string | null
          free_credits_remaining?: number | null
          id?: string
          image_credits_remaining?: number | null
          image_daily_limit?: number | null
          image_daily_used?: number | null
          last_purchase?: string | null
          paid_credits_balance?: number | null
          updated_at?: string | null
          user_id?: string
          video_credits_remaining?: number | null
          video_daily_limit?: number | null
          video_daily_used?: number | null
        }
        Relationships: []
      }
      ghost_folders: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ghost_library: {
        Row: {
          content_type: string
          created_at: string | null
          duration_seconds: number | null
          encrypted: boolean | null
          file_size_bytes: number | null
          folder_id: string | null
          format: string | null
          height: number | null
          id: string
          is_favorite: boolean | null
          model_id: string | null
          prompt: string | null
          storage_key: string
          storage_type: string
          tags: string[] | null
          thumbnail_key: string | null
          title: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          duration_seconds?: number | null
          encrypted?: boolean | null
          file_size_bytes?: number | null
          folder_id?: string | null
          format?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          model_id?: string | null
          prompt?: string | null
          storage_key: string
          storage_type: string
          tags?: string[] | null
          thumbnail_key?: string | null
          title?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          duration_seconds?: number | null
          encrypted?: boolean | null
          file_size_bytes?: number | null
          folder_id?: string | null
          format?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          model_id?: string | null
          prompt?: string | null
          storage_key?: string
          storage_type?: string
          tags?: string[] | null
          thumbnail_key?: string | null
          title?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      ghost_settings: {
        Row: {
          accent_color: string | null
          arrow_key_nav: boolean | null
          created_at: string | null
          default_temperature: number | null
          default_top_p: number | null
          disable_system_prompt: boolean | null
          disable_telemetry: boolean | null
          enter_after_edit: string | null
          enter_submits: boolean | null
          hide_personal_info: boolean | null
          id: string
          image_aspect_ratio: string | null
          image_embed_exif: boolean | null
          image_enhance_prompts: boolean | null
          image_format: string | null
          image_hide_watermark: boolean | null
          mature_filter_enabled: boolean | null
          show_external_link_warning: boolean | null
          show_message_date: boolean | null
          start_temporary: boolean | null
          system_prompt: string | null
          theme: string | null
          updated_at: string | null
          url_scraping: boolean | null
          user_id: string
          voice_id: string | null
          voice_language: string | null
          voice_read_responses: boolean | null
          voice_speed: number | null
          web_enabled: boolean | null
        }
        Insert: {
          accent_color?: string | null
          arrow_key_nav?: boolean | null
          created_at?: string | null
          default_temperature?: number | null
          default_top_p?: number | null
          disable_system_prompt?: boolean | null
          disable_telemetry?: boolean | null
          enter_after_edit?: string | null
          enter_submits?: boolean | null
          hide_personal_info?: boolean | null
          id?: string
          image_aspect_ratio?: string | null
          image_embed_exif?: boolean | null
          image_enhance_prompts?: boolean | null
          image_format?: string | null
          image_hide_watermark?: boolean | null
          mature_filter_enabled?: boolean | null
          show_external_link_warning?: boolean | null
          show_message_date?: boolean | null
          start_temporary?: boolean | null
          system_prompt?: string | null
          theme?: string | null
          updated_at?: string | null
          url_scraping?: boolean | null
          user_id: string
          voice_id?: string | null
          voice_language?: string | null
          voice_read_responses?: boolean | null
          voice_speed?: number | null
          web_enabled?: boolean | null
        }
        Update: {
          accent_color?: string | null
          arrow_key_nav?: boolean | null
          created_at?: string | null
          default_temperature?: number | null
          default_top_p?: number | null
          disable_system_prompt?: boolean | null
          disable_telemetry?: boolean | null
          enter_after_edit?: string | null
          enter_submits?: boolean | null
          hide_personal_info?: boolean | null
          id?: string
          image_aspect_ratio?: string | null
          image_embed_exif?: boolean | null
          image_enhance_prompts?: boolean | null
          image_format?: string | null
          image_hide_watermark?: boolean | null
          mature_filter_enabled?: boolean | null
          show_external_link_warning?: boolean | null
          show_message_date?: boolean | null
          start_temporary?: boolean | null
          system_prompt?: string | null
          theme?: string | null
          updated_at?: string | null
          url_scraping?: boolean | null
          user_id?: string
          voice_id?: string | null
          voice_language?: string | null
          voice_read_responses?: boolean | null
          voice_speed?: number | null
          web_enabled?: boolean | null
        }
        Relationships: []
      }
      ghost_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          ghost_tokens_limit: number
          id: string
          plan: string
          started_at: string | null
          tier: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          ghost_tokens_limit?: number
          id?: string
          plan: string
          started_at?: string | null
          tier?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          ghost_tokens_limit?: number
          id?: string
          plan?: string
          started_at?: string | null
          tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ghost_usage: {
        Row: {
          created_at: string | null
          credits_used: number | null
          duration_seconds: number | null
          files_uploaded: number | null
          generation_time_ms: number | null
          id: string
          images_generated: number | null
          input_tokens: number
          modality: string | null
          model_id: string
          output_tokens: number
          prompts_used: number | null
          provider: string | null
          resolution: string | null
          usage_date: string | null
          user_id: string
          videos_generated: number | null
          was_free_tier: boolean | null
          web_searches: number | null
        }
        Insert: {
          created_at?: string | null
          credits_used?: number | null
          duration_seconds?: number | null
          files_uploaded?: number | null
          generation_time_ms?: number | null
          id?: string
          images_generated?: number | null
          input_tokens: number
          modality?: string | null
          model_id: string
          output_tokens: number
          prompts_used?: number | null
          provider?: string | null
          resolution?: string | null
          usage_date?: string | null
          user_id: string
          videos_generated?: number | null
          was_free_tier?: boolean | null
          web_searches?: number | null
        }
        Update: {
          created_at?: string | null
          credits_used?: number | null
          duration_seconds?: number | null
          files_uploaded?: number | null
          generation_time_ms?: number | null
          id?: string
          images_generated?: number | null
          input_tokens?: number
          modality?: string | null
          model_id?: string
          output_tokens?: number
          prompts_used?: number | null
          provider?: string | null
          resolution?: string | null
          usage_date?: string | null
          user_id?: string
          videos_generated?: number | null
          was_free_tier?: boolean | null
          web_searches?: number | null
        }
        Relationships: []
      }
      inference_stats: {
        Row: {
          cache_tier: string | null
          id: string
          model: string
          provider: string
          response_time_ms: number | null
          success: boolean | null
          timestamp: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          cache_tier?: string | null
          id?: string
          model: string
          provider: string
          response_time_ms?: number | null
          success?: boolean | null
          timestamp?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          cache_tier?: string | null
          id?: string
          model?: string
          provider?: string
          response_time_ms?: number | null
          success?: boolean | null
          timestamp?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      knowledge_project_conversations: {
        Row: {
          created_at: string | null
          id: string
          messages: Json | null
          metadata: Json | null
          model: string
          project_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          metadata?: Json | null
          model: string
          project_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          metadata?: Json | null
          model?: string
          project_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_project_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "knowledge_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_project_files: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          document_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          project_id: string
          status: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          document_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          status?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          document_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "knowledge_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_project_memory: {
        Row: {
          category: string | null
          confidence: number | null
          content: string
          created_at: string | null
          id: string
          project_id: string
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          category?: string | null
          confidence?: number | null
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_project_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "knowledge_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_projects: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          instructions: string | null
          is_archived: boolean | null
          name: string
          settings: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean | null
          name: string
          settings?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      metrics: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_builtin: boolean | null
          metric_type: string | null
          name: string
          project_id: string | null
          rules: Json
          system_prompt: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean | null
          metric_type?: string | null
          name: string
          project_id?: string | null
          rules?: Json
          system_prompt?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean | null
          metric_type?: string | null
          name?: string
          project_id?: string | null
          rules?: Json
          system_prompt?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          base_model: string
          context_length: number | null
          created_at: string | null
          deployed_at: string | null
          deployment_config: Json | null
          deployment_endpoint: string | null
          deployment_status: string | null
          description: string | null
          finetuning_job_id: string | null
          id: string
          is_deployed: boolean | null
          model_id: string
          name: string
          organization_id: string | null
          parameter_count: number | null
          s3_checkpoint_path: string | null
          s3_gguf_path: string | null
          user_id: string
        }
        Insert: {
          base_model: string
          context_length?: number | null
          created_at?: string | null
          deployed_at?: string | null
          deployment_config?: Json | null
          deployment_endpoint?: string | null
          deployment_status?: string | null
          description?: string | null
          finetuning_job_id?: string | null
          id?: string
          is_deployed?: boolean | null
          model_id: string
          name: string
          organization_id?: string | null
          parameter_count?: number | null
          s3_checkpoint_path?: string | null
          s3_gguf_path?: string | null
          user_id: string
        }
        Update: {
          base_model?: string
          context_length?: number | null
          created_at?: string | null
          deployed_at?: string | null
          deployment_config?: Json | null
          deployment_endpoint?: string | null
          deployment_status?: string | null
          description?: string | null
          finetuning_job_id?: string | null
          id?: string
          is_deployed?: boolean | null
          model_id?: string
          name?: string
          organization_id?: string | null
          parameter_count?: number | null
          s3_checkpoint_path?: string | null
          s3_gguf_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_finetuning_job_id_fkey"
            columns: ["finetuning_job_id"]
            isOneToOne: false
            referencedRelation: "finetuning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooklm_notebooks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          notebook_id: string
          sources: Json | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          notebook_id: string
          sources?: Json | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          notebook_id?: string
          sources?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notebooklm_outputs: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          notebook_id: string | null
          output_type: string
          task_id: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          output_type: string
          task_id?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          output_type?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooklm_outputs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooklm_notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebooklm_outputs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooklm_sources: {
        Row: {
          content_preview: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          notebook_id: string | null
          source_type: string
          source_uri: string | null
          title: string | null
        }
        Insert: {
          content_preview?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          source_type: string
          source_uri?: string | null
          title?: string | null
        }
        Update: {
          content_preview?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          source_type?: string
          source_uri?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooklm_sources_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooklm_notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          digest_frequency: string | null
          email_enabled: boolean | null
          id: string
          push_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          slack_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          webhook_url: string | null
        }
        Insert: {
          digest_frequency?: string | null
          email_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          slack_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          digest_frequency?: string | null
          email_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          slack_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          provider: string
          state: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          provider: string
          state: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          provider?: string
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      org_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          organization_id: string | null
          permissions: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          organization_id?: string | null
          permissions?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          organization_id?: string | null
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          token: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string
          subscription_id: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          slug: string
          subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string
          subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "unified_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_templates: {
        Row: {
          colors: Json | null
          created_at: string | null
          fonts: Json | null
          id: string
          is_premium: boolean | null
          name: string
          preview_url: string | null
          theme_name: string | null
        }
        Insert: {
          colors?: Json | null
          created_at?: string | null
          fonts?: Json | null
          id?: string
          is_premium?: boolean | null
          name: string
          preview_url?: string | null
          theme_name?: string | null
        }
        Update: {
          colors?: Json | null
          created_at?: string | null
          fonts?: Json | null
          id?: string
          is_premium?: boolean | null
          name?: string
          preview_url?: string | null
          theme_name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          settings: Json | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      research_items: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          item_index: number
          item_input: string
          job_id: string | null
          result: Json | null
          sources: Json | null
          started_at: string | null
          status: string | null
          worker_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          item_index: number
          item_input: string
          job_id?: string | null
          result?: Json | null
          sources?: Json | null
          started_at?: string | null
          status?: string | null
          worker_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          item_index?: number
          item_input?: string
          job_id?: string | null
          result?: Json | null
          sources?: Json | null
          started_at?: string | null
          status?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "wide_research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_queries: {
        Row: {
          citations_encrypted: string | null
          citations_nonce: string | null
          citations_plaintext: Json | null
          conversation_id: string | null
          created_at: string | null
          id: string
          input_tokens: number | null
          is_encrypted: boolean | null
          mode: string
          model: string
          organization_id: string | null
          output_tokens: number | null
          processing_time_ms: number | null
          query_encrypted: string | null
          query_nonce: string | null
          query_plaintext: string | null
          reasoning_tokens: number | null
          response_encrypted: string | null
          response_nonce: string | null
          search_queries_count: number | null
          status: string | null
          total_cost: number | null
          user_id: string
        }
        Insert: {
          citations_encrypted?: string | null
          citations_nonce?: string | null
          citations_plaintext?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          is_encrypted?: boolean | null
          mode?: string
          model?: string
          organization_id?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          query_encrypted?: string | null
          query_nonce?: string | null
          query_plaintext?: string | null
          reasoning_tokens?: number | null
          response_encrypted?: string | null
          response_nonce?: string | null
          search_queries_count?: number | null
          status?: string | null
          total_cost?: number | null
          user_id: string
        }
        Update: {
          citations_encrypted?: string | null
          citations_nonce?: string | null
          citations_plaintext?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          is_encrypted?: boolean | null
          mode?: string
          model?: string
          organization_id?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          query_encrypted?: string | null
          query_nonce?: string | null
          query_plaintext?: string | null
          reasoning_tokens?: number | null
          response_encrypted?: string | null
          response_nonce?: string | null
          search_queries_count?: number | null
          status?: string | null
          total_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_queries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "encrypted_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_queries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_quotas: {
        Row: {
          created_at: string | null
          deep_research_enabled: boolean | null
          id: string
          max_tokens_per_query: number | null
          models_allowed: string[] | null
          monthly_queries: number
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deep_research_enabled?: boolean | null
          id?: string
          max_tokens_per_query?: number | null
          models_allowed?: string[] | null
          monthly_queries: number
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deep_research_enabled?: boolean | null
          id?: string
          max_tokens_per_query?: number | null
          models_allowed?: string[] | null
          monthly_queries?: number
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system_role: boolean | null
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_task_runs: {
        Row: {
          agent_task_id: string | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          result_summary: string | null
          scheduled_task_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          agent_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result_summary?: string | null
          scheduled_task_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          agent_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result_summary?: string | null
          scheduled_task_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_task_runs_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_task_runs_scheduled_task_id_fkey"
            columns: ["scheduled_task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_tasks: {
        Row: {
          created_at: string | null
          cron_expression: string | null
          description: string | null
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_run_at: string | null
          max_retries: number | null
          name: string
          next_run_at: string | null
          notify_channels: Json | null
          notify_on_complete: boolean | null
          notify_on_failure: boolean | null
          prompt: string
          retry_count: number | null
          run_count: number | null
          schedule_type: string
          success_count: number | null
          task_type: string | null
          timeout_minutes: number | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          max_retries?: number | null
          name: string
          next_run_at?: string | null
          notify_channels?: Json | null
          notify_on_complete?: boolean | null
          notify_on_failure?: boolean | null
          prompt: string
          retry_count?: number | null
          run_count?: number | null
          schedule_type: string
          success_count?: number | null
          task_type?: string | null
          timeout_minutes?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cron_expression?: string | null
          description?: string | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          max_retries?: number | null
          name?: string
          next_run_at?: string | null
          notify_channels?: Json | null
          notify_on_complete?: boolean | null
          notify_on_failure?: boolean | null
          prompt?: string
          retry_count?: number | null
          run_count?: number | null
          schedule_type?: string
          success_count?: number | null
          task_type?: string | null
          timeout_minutes?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      semantic_cache: {
        Row: {
          created_at: string | null
          embedding: string | null
          hit_count: number | null
          id: string
          model: string
          prompt: string
          prompt_hash: string
          provider: string
          response: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          id?: string
          model: string
          prompt: string
          prompt_hash: string
          provider: string
          response: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          id?: string
          model?: string
          prompt?: string
          prompt_hash?: string
          provider?: string
          response?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sso_audit_logs: {
        Row: {
          created_at: string | null
          email: string | null
          error_message: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          sso_config_id: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          sso_config_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          sso_config_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_audit_logs_sso_config_id_fkey"
            columns: ["sso_config_id"]
            isOneToOne: false
            referencedRelation: "sso_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_configurations: {
        Row: {
          attribute_mapping: Json | null
          authorization_url: string | null
          auto_provision_users: boolean | null
          certificate: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          display_name: string | null
          domain_whitelist: string[] | null
          enforce_sso: boolean | null
          id: string
          is_active: boolean | null
          issuer_url: string | null
          metadata_url: string | null
          organization_id: string | null
          provider_name: string
          provider_type: string
          scopes: string[] | null
          token_url: string | null
          updated_at: string | null
          userinfo_url: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          authorization_url?: string | null
          auto_provision_users?: boolean | null
          certificate?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          display_name?: string | null
          domain_whitelist?: string[] | null
          enforce_sso?: boolean | null
          id?: string
          is_active?: boolean | null
          issuer_url?: string | null
          metadata_url?: string | null
          organization_id?: string | null
          provider_name: string
          provider_type: string
          scopes?: string[] | null
          token_url?: string | null
          updated_at?: string | null
          userinfo_url?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          authorization_url?: string | null
          auto_provision_users?: boolean | null
          certificate?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          display_name?: string | null
          domain_whitelist?: string[] | null
          enforce_sso?: boolean | null
          id?: string
          is_active?: boolean | null
          issuer_url?: string | null
          metadata_url?: string | null
          organization_id?: string | null
          provider_name?: string
          provider_type?: string
          scopes?: string[] | null
          token_url?: string | null
          updated_at?: string | null
          userinfo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_sessions: {
        Row: {
          code_verifier: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          nonce: string | null
          original_url: string | null
          redirect_uri: string | null
          sso_config_id: string
          state: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          code_verifier?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          nonce?: string | null
          original_url?: string | null
          redirect_uri?: string | null
          sso_config_id: string
          state: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          code_verifier?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          nonce?: string | null
          original_url?: string | null
          redirect_uri?: string | null
          sso_config_id?: string
          state?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_sessions_sso_config_id_fkey"
            columns: ["sso_config_id"]
            isOneToOne: false
            referencedRelation: "sso_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          created_at: string | null
          display_name: string
          features_json: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_monthly_cents: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features_json?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features_json?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly_cents?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          can_access_new_models: boolean | null
          can_backup_history: boolean | null
          can_manage_org: boolean | null
          can_train_models: boolean | null
          can_use_api: boolean | null
          can_use_integrations: boolean | null
          can_use_vault_chat: boolean | null
          can_use_vault_labs: boolean | null
          created_at: string | null
          deep_research_per_day: number | null
          display_name: string
          images_per_day: number | null
          one_time_credit_grant: number | null
          price_monthly_cents: number | null
          price_yearly_cents: number | null
          text_prompts_per_day: number | null
          tier: string
          updated_at: string | null
          videos_per_day: number | null
        }
        Insert: {
          can_access_new_models?: boolean | null
          can_backup_history?: boolean | null
          can_manage_org?: boolean | null
          can_train_models?: boolean | null
          can_use_api?: boolean | null
          can_use_integrations?: boolean | null
          can_use_vault_chat?: boolean | null
          can_use_vault_labs?: boolean | null
          created_at?: string | null
          deep_research_per_day?: number | null
          display_name: string
          images_per_day?: number | null
          one_time_credit_grant?: number | null
          price_monthly_cents?: number | null
          price_yearly_cents?: number | null
          text_prompts_per_day?: number | null
          tier: string
          updated_at?: string | null
          videos_per_day?: number | null
        }
        Update: {
          can_access_new_models?: boolean | null
          can_backup_history?: boolean | null
          can_manage_org?: boolean | null
          can_train_models?: boolean | null
          can_use_api?: boolean | null
          can_use_integrations?: boolean | null
          can_use_vault_chat?: boolean | null
          can_use_vault_labs?: boolean | null
          created_at?: string | null
          deep_research_per_day?: number | null
          display_name?: string
          images_per_day?: number | null
          one_time_credit_grant?: number | null
          price_monthly_cents?: number | null
          price_yearly_cents?: number | null
          text_prompts_per_day?: number | null
          tier?: string
          updated_at?: string | null
          videos_per_day?: number | null
        }
        Relationships: []
      }
      traces: {
        Row: {
          api_key_id: string | null
          completion_tokens: number | null
          created_at: string | null
          error_message: string | null
          id: string
          ip_address: unknown
          latency_ms: number | null
          model_id: string
          project_id: string | null
          prompt_tokens: number | null
          request: Json
          response: Json | null
          status_code: number | null
          total_tokens: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          latency_ms?: number | null
          model_id: string
          project_id?: string | null
          prompt_tokens?: number | null
          request: Json
          response?: Json | null
          status_code?: number | null
          total_tokens?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          latency_ms?: number | null
          model_id?: string
          project_id?: string | null
          prompt_tokens?: number | null
          request?: Json
          response?: Json | null
          status_code?: number | null
          total_tokens?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traces_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_credits: {
        Row: {
          allowance_resets_at: string | null
          created_at: string | null
          grant_balance: number | null
          id: string
          monthly_allowance: number | null
          monthly_used: number | null
          purchased_balance: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowance_resets_at?: string | null
          created_at?: string | null
          grant_balance?: number | null
          id?: string
          monthly_allowance?: number | null
          monthly_used?: number | null
          purchased_balance?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowance_resets_at?: string | null
          created_at?: string | null
          grant_balance?: number | null
          id?: string
          monthly_allowance?: number | null
          monthly_used?: number | null
          purchased_balance?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      unified_daily_usage: {
        Row: {
          created_at: string | null
          deep_research: number | null
          id: string
          image_requests: number | null
          text_prompts: number | null
          usage_date: string | null
          user_id: string
          video_requests: number | null
        }
        Insert: {
          created_at?: string | null
          deep_research?: number | null
          id?: string
          image_requests?: number | null
          text_prompts?: number | null
          usage_date?: string | null
          user_id: string
          video_requests?: number | null
        }
        Update: {
          created_at?: string | null
          deep_research?: number | null
          id?: string
          image_requests?: number | null
          text_prompts?: number | null
          usage_date?: string | null
          user_id?: string
          video_requests?: number | null
        }
        Relationships: []
      }
      unified_subscriptions: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string | null
          seats_purchased: number | null
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string | null
          seats_purchased?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string | null
          seats_purchased?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_daily: {
        Row: {
          created_at: string | null
          date: string
          id: string
          metric: string
          user_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          metric: string
          user_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          metric?: string
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_finetuning: {
        Row: {
          base_model: string | null
          cost: number | null
          created_at: string | null
          gpu_minutes: number | null
          id: string
          job_id: string | null
          user_id: string | null
        }
        Insert: {
          base_model?: string | null
          cost?: number | null
          created_at?: string | null
          gpu_minutes?: number | null
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Update: {
          base_model?: string | null
          cost?: number | null
          created_at?: string | null
          gpu_minutes?: number | null
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_finetuning_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "finetuning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_finetuning_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_encryption_settings: {
        Row: {
          auto_lock_minutes: number | null
          created_at: string | null
          kdf_iterations: number | null
          kdf_memory: number | null
          kdf_salt: string
          key_verification_hash: string | null
          recovery_key_hash: string | null
          updated_at: string | null
          user_id: string
          zero_retention_default: boolean | null
        }
        Insert: {
          auto_lock_minutes?: number | null
          created_at?: string | null
          kdf_iterations?: number | null
          kdf_memory?: number | null
          kdf_salt: string
          key_verification_hash?: string | null
          recovery_key_hash?: string | null
          updated_at?: string | null
          user_id: string
          zero_retention_default?: boolean | null
        }
        Update: {
          auto_lock_minutes?: number | null
          created_at?: string | null
          kdf_iterations?: number | null
          kdf_memory?: number | null
          kdf_salt?: string
          key_verification_hash?: string | null
          recovery_key_hash?: string | null
          updated_at?: string | null
          user_id?: string
          zero_retention_default?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          account_type: string | null
          created_at: string | null
          current_organization_id: string | null
          data_retention_days: number | null
          deep_research_enabled: boolean | null
          feature_access: Json | null
          id: string
          log_retention_days: number | null
          notification_browser: boolean | null
          notification_email: boolean | null
          preferences: Json | null
          updated_at: string | null
          user_id: string
          zero_retention_mode: boolean | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string | null
          current_organization_id?: string | null
          data_retention_days?: number | null
          deep_research_enabled?: boolean | null
          feature_access?: Json | null
          id?: string
          log_retention_days?: number | null
          notification_browser?: boolean | null
          notification_email?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
          user_id: string
          zero_retention_mode?: boolean | null
        }
        Update: {
          account_type?: string | null
          created_at?: string | null
          current_organization_id?: string | null
          data_retention_days?: number | null
          deep_research_enabled?: boolean | null
          feature_access?: Json | null
          id?: string
          log_retention_days?: number | null
          notification_browser?: boolean | null
          notification_email?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string
          zero_retention_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_chat_conversations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          encryption_key_hash: string
          id: string
          is_encrypted: boolean | null
          is_shared: boolean | null
          last_message_at: string | null
          message_count: number | null
          model_id: string
          organization_id: string | null
          system_prompt: string | null
          title: string
          total_tokens: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_hash: string
          id?: string
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          model_id?: string
          organization_id?: string | null
          system_prompt?: string | null
          title?: string
          total_tokens?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          encryption_key_hash?: string
          id?: string
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          model_id?: string
          organization_id?: string | null
          system_prompt?: string | null
          title?: string
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_chat_messages: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          credits_used: number | null
          encrypted_content: string
          finish_reason: string | null
          id: string
          latency_ms: number | null
          model_used: string | null
          role: string
          token_count: number | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          encrypted_content: string
          finish_reason?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role: string
          token_count?: number | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          credits_used?: number | null
          encrypted_content?: string
          finish_reason?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vault_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_chat_shared_conversations: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          permission: string
          shared_by_user_id: string | null
          shared_with_user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          permission?: string
          shared_by_user_id?: string | null
          shared_with_user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          permission?: string
          shared_by_user_id?: string | null
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_chat_shared_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vault_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_mail_accounts: {
        Row: {
          created_at: string | null
          display_name: string | null
          email_address: string
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          profile_picture: string | null
          provider: string
          scopes: string[] | null
          sync_cursor: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          total_emails_synced: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email_address: string
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          profile_picture?: string | null
          provider: string
          scopes?: string[] | null
          sync_cursor?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          total_emails_synced?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          profile_picture?: string | null
          provider?: string
          scopes?: string[] | null
          sync_cursor?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          total_emails_synced?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vault_mail_drafts: {
        Row: {
          account_id: string | null
          ai_model: string | null
          body_html: string | null
          body_text: string | null
          cc_addresses: Json | null
          created_at: string | null
          id: string
          sent_at: string | null
          status: string | null
          subject: string | null
          thread_id: string | null
          to_addresses: Json | null
          tone: string | null
          updated_at: string | null
          user_id: string
          user_intent: string | null
        }
        Insert: {
          account_id?: string | null
          ai_model?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_addresses?: Json | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
          user_intent?: string | null
        }
        Update: {
          account_id?: string | null
          ai_model?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_addresses?: Json | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
          user_intent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_mail_drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vault_mail_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_mail_drafts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "vault_mail_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_mail_messages: {
        Row: {
          attachment_count: number | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_addresses: Json | null
          created_at: string | null
          from_address: string
          from_name: string | null
          id: string
          in_reply_to: string | null
          is_sent_by_user: boolean | null
          message_id: string
          sent_at: string | null
          subject: string | null
          thread_id: string
          to_addresses: Json | null
        }
        Insert: {
          attachment_count?: number | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          from_address: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_sent_by_user?: boolean | null
          message_id: string
          sent_at?: string | null
          subject?: string | null
          thread_id: string
          to_addresses?: Json | null
        }
        Update: {
          attachment_count?: number | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          from_address?: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_sent_by_user?: boolean | null
          message_id?: string
          sent_at?: string | null
          subject?: string | null
          thread_id?: string
          to_addresses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_mail_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "vault_mail_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_mail_style_profiles: {
        Row: {
          average_length: number | null
          closing_patterns: Json | null
          common_phrases: Json | null
          created_at: string | null
          greeting_patterns: Json | null
          id: string
          last_analyzed_at: string | null
          samples_analyzed: number | null
          signature: string | null
          tone_markers: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_length?: number | null
          closing_patterns?: Json | null
          common_phrases?: Json | null
          created_at?: string | null
          greeting_patterns?: Json | null
          id?: string
          last_analyzed_at?: string | null
          samples_analyzed?: number | null
          signature?: string | null
          tone_markers?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_length?: number | null
          closing_patterns?: Json | null
          common_phrases?: Json | null
          created_at?: string | null
          greeting_patterns?: Json | null
          id?: string
          last_analyzed_at?: string | null
          samples_analyzed?: number | null
          signature?: string | null
          tone_markers?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vault_mail_threads: {
        Row: {
          account_id: string
          category: string | null
          category_confidence: number | null
          category_set_by: string | null
          created_at: string | null
          first_message_at: string | null
          has_attachments: boolean | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          is_trashed: boolean | null
          labels: string[] | null
          latest_message_at: string | null
          message_count: number | null
          snippet: string | null
          subject: string | null
          suggested_action: string | null
          thread_id: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          category?: string | null
          category_confidence?: number | null
          category_set_by?: string | null
          created_at?: string | null
          first_message_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          is_trashed?: boolean | null
          labels?: string[] | null
          latest_message_at?: string | null
          message_count?: number | null
          snippet?: string | null
          subject?: string | null
          suggested_action?: string | null
          thread_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          category?: string | null
          category_confidence?: number | null
          category_set_by?: string | null
          created_at?: string | null
          first_message_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          is_trashed?: boolean | null
          labels?: string[] | null
          latest_message_at?: string | null
          message_count?: number | null
          snippet?: string | null
          subject?: string | null
          suggested_action?: string | null
          thread_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_mail_threads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "vault_mail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wide_research_jobs: {
        Row: {
          avg_item_duration_ms: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          items_completed: number | null
          items_data: Json
          items_failed: number | null
          max_workers: number | null
          parallel_workers: number | null
          research_type: string | null
          result_file_path: string | null
          result_format: string | null
          results: Json | null
          started_at: string | null
          task_id: string | null
          template_id: string | null
          total_items: number
          user_id: string
          worker_status: Json | null
        }
        Insert: {
          avg_item_duration_ms?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          items_completed?: number | null
          items_data: Json
          items_failed?: number | null
          max_workers?: number | null
          parallel_workers?: number | null
          research_type?: string | null
          result_file_path?: string | null
          result_format?: string | null
          results?: Json | null
          started_at?: string | null
          task_id?: string | null
          template_id?: string | null
          total_items: number
          user_id: string
          worker_status?: Json | null
        }
        Update: {
          avg_item_duration_ms?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          items_completed?: number | null
          items_data?: Json
          items_failed?: number | null
          max_workers?: number | null
          parallel_workers?: number | null
          research_type?: string | null
          result_file_path?: string | null
          result_format?: string | null
          results?: Json | null
          started_at?: string | null
          task_id?: string | null
          template_id?: string | null
          total_items?: number
          user_id?: string
          worker_status?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "wide_research_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      template_summary: {
        Row: {
          description: string | null
          difficulty: string | null
          domain: string | null
          estimated_time: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          language: string | null
          language_code: string | null
          name: string | null
          recommended_model: string | null
          slug: string | null
          use_cases: string[] | null
        }
        Insert: {
          description?: string | null
          difficulty?: string | null
          domain?: string | null
          estimated_time?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          language?: string | null
          language_code?: string | null
          name?: string | null
          recommended_model?: string | null
          slug?: string | null
          use_cases?: string[] | null
        }
        Update: {
          description?: string | null
          difficulty?: string | null
          domain?: string | null
          estimated_time?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          language?: string | null
          language_code?: string | null
          name?: string | null
          recommended_model?: string | null
          slug?: string | null
          use_cases?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: {
          created_at: string | null
          id: string
          joined_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_role: {
        Args: { _expires_at?: string; _role_name: string; _user_id: string }
        Returns: string
      }
      calculate_next_cron_run: {
        Args: {
          p_cron_expression: string
          p_from_time?: string
          p_timezone?: string
        }
        Returns: string
      }
      calculate_next_run: {
        Args: {
          p_cron_expression: string
          p_schedule_type: string
          p_timezone: string
        }
        Returns: string
      }
      check_anonymous_usage: {
        Args: {
          p_fingerprint?: string
          p_ip_hash: string
          p_usage_type?: string
        }
        Returns: Json
      }
      check_ghost_usage: {
        Args: { p_type: string; p_user_id: string }
        Returns: Json
      }
      check_scheduled_tasks: { Args: never; Returns: number }
      check_unified_usage: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      check_user_usage: {
        Args: {
          p_estimated_cost_cents?: number
          p_usage_type: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_api_key_usage: { Args: never; Returns: number }
      cleanup_expired_messages: { Args: never; Returns: number }
      clear_conversation_documents: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: number
      }
      create_api_key: {
        Args: {
          p_expires_at?: string
          p_name: string
          p_permissions?: Json
          p_rate_limit?: number
        }
        Returns: Json
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_org_id?: string
          p_request_body?: Json
          p_resource_id?: string
          p_resource_type?: string
          p_response_status?: number
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { p_avatar_url?: string; p_name: string; p_slug: string }
        Returns: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string
          subscription_id: string | null
          tier: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deduct_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_service_type: string
          p_user_id: string
        }
        Returns: Json
      }
      deduct_ghost_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      deduct_unified_credits: {
        Args: { p_amount: number; p_source: string; p_user_id: string }
        Returns: {
          error_message: string
          remaining: number
          success: boolean
        }[]
      }
      get_ghost_tier: { Args: { p_user_id: string }; Returns: Json }
      get_ghost_usage: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string | null
          credits_used: number | null
          duration_seconds: number | null
          files_uploaded: number | null
          generation_time_ms: number | null
          id: string
          images_generated: number | null
          input_tokens: number
          modality: string | null
          model_id: string
          output_tokens: number
          prompts_used: number | null
          provider: string | null
          resolution: string | null
          usage_date: string | null
          user_id: string
          videos_generated: number | null
          was_free_tier: boolean | null
          web_searches: number | null
        }
        SetofOptions: {
          from: "*"
          to: "ghost_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_next_sequence_number: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      get_org_member_profiles: {
        Args: { p_org_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_research_quota: { Args: never; Returns: Json }
      get_subscription_status: { Args: { p_user_id: string }; Returns: Json }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          permissions: Json
          role_id: string
          role_name: string
        }[]
      }
      get_user_tier: {
        Args: { p_user_id: string }
        Returns: {
          is_org_member: boolean
          org_id: string
          org_name: string
          tier: string
          tier_display_name: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role_name: string; _user_id: string }; Returns: boolean }
      increment_ghost_usage: {
        Args: { p_type: string; p_user_id: string }
        Returns: Json
      }
      increment_unified_usage: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      increment_usage: {
        Args: {
          p_date: string
          p_metric: string
          p_user_id: string
          p_value: number
        }
        Returns: undefined
      }
      is_mail_token_expired: { Args: { account_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member_with_role: {
        Args: { _org_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      list_api_keys: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          key_prefix: string
          last_used_at: string
          name: string
          permissions: Json
          rate_limit: number
        }[]
      }
      log_sso_event: {
        Args: {
          p_config_id: string
          p_email?: string
          p_error?: string
          p_event_type: string
          p_metadata?: Json
          p_org_id: string
          p_success?: boolean
          p_user_id?: string
        }
        Returns: string
      }
      match_semantic_cache: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          prompt: string
          response: string
          similarity: number
        }[]
      }
      record_ghost_usage: {
        Args: {
          p_duration_seconds?: number
          p_input_tokens?: number
          p_model_id: string
          p_output_tokens?: number
          p_resolution?: string
          p_service_type: string
          p_user_id: string
        }
        Returns: Json
      }
      reset_ghost_daily_limits: { Args: never; Returns: undefined }
      revoke_api_key: { Args: { p_key_id: string }; Returns: boolean }
      search_document_chunks: {
        Args: {
          p_conversation_id?: string
          p_embedding?: string
          p_match_count?: number
          p_match_threshold?: number
          p_user_id: string
        }
        Returns: {
          chunk_index: number
          content: string
          filename: string
          id: string
          similarity: number
        }[]
      }
      search_similar_chunks: {
        Args: {
          p_conversation_id?: string
          p_embedding: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          content: string
          filename: string
          id: string
          similarity: number
        }[]
      }
      setup_vaultchat_only_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      user_owns_vault_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      validate_api_key: {
        Args: { p_key_hash: string; p_key_prefix: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "owner" | "member" | "viewer"
      dataset_source_type: "upload" | "synthetic" | "enriched" | "merged"
      dataset_status: "pending" | "processing" | "ready" | "error"
      evaluation_status: "pending" | "running" | "completed" | "failed"
      finetuning_method: "full" | "lora" | "qlora"
      finetuning_status:
        | "pending"
        | "queued"
        | "training"
        | "completed"
        | "failed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "owner", "member", "viewer"],
      dataset_source_type: ["upload", "synthetic", "enriched", "merged"],
      dataset_status: ["pending", "processing", "ready", "error"],
      evaluation_status: ["pending", "running", "completed", "failed"],
      finetuning_method: ["full", "lora", "qlora"],
      finetuning_status: [
        "pending",
        "queued",
        "training",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
