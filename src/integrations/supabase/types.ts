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
          deployment_config: Json | null
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
          deployment_config?: Json | null
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
          deployment_config?: Json | null
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
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
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
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          tier?: string | null
          updated_at?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
