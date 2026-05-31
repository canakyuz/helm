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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          current_value: number | null
          delivered: boolean
          id: number
          message: string
          metric: string
          reference_value: number | null
          rule_id: string | null
          triggered_at: string
        }
        Insert: {
          current_value?: number | null
          delivered?: boolean
          id?: never
          message: string
          metric: string
          reference_value?: number | null
          rule_id?: string | null
          triggered_at?: string
        }
        Update: {
          current_value?: number | null
          delivered?: boolean
          id?: never
          message?: string
          metric?: string
          reference_value?: number | null
          rule_id?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          channel: string
          condition: string
          created_at: string
          enabled: boolean
          id: string
          metric: string
          name: string
          project_id: string | null
          threshold: number
        }
        Insert: {
          channel?: string
          condition: string
          created_at?: string
          enabled?: boolean
          id?: string
          metric: string
          name: string
          project_id?: string | null
          threshold: number
        }
        Update: {
          channel?: string
          condition?: string
          created_at?: string
          enabled?: boolean
          id?: string
          metric?: string
          name?: string
          project_id?: string | null
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          build_number: string | null
          expires_at: string | null
          fetched_at: string
          id: number
          project_id: string
          release_date: string | null
          release_notes: string | null
          source: string
          state_changed_at: string | null
          status: string | null
          version: string
        }
        Insert: {
          build_number?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: never
          project_id: string
          release_date?: string | null
          release_notes?: string | null
          source?: string
          state_changed_at?: string | null
          status?: string | null
          version: string
        }
        Update: {
          build_number?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: never
          project_id?: string
          release_date?: string | null
          release_notes?: string | null
          source?: string
          state_changed_at?: string | null
          status?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          detail: string | null
          id: number
          project_id: string | null
          target_user: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          project_id?: string | null
          target_user?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          project_id?: string | null
          target_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      campaign_events: {
        Row: {
          campaign_id: number | null
          email_id: string
          event: string
          id: number
          occurred_at: string
          recipient: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id?: number | null
          email_id: string
          event: string
          id?: never
          occurred_at?: string
          recipient?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: number | null
          email_id?: string
          event?: string
          id?: never
          occurred_at?: string
          recipient?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string | null
          channel: string
          error: string | null
          failed: number
          id: number
          project_id: string | null
          recipients: number
          segment_id: string | null
          sent: number
          sent_at: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          error?: string | null
          failed?: number
          id?: never
          project_id?: string | null
          recipients?: number
          segment_id?: string | null
          sent?: number
          sent_at?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          error?: string | null
          failed?: number
          id?: never
          project_id?: string | null
          recipients?: number
          segment_id?: string | null
          sent?: number
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "user_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_assets: {
        Row: {
          alt: string | null
          bytes: number | null
          created_at: string
          created_by: string | null
          filename: string
          height: number | null
          id: string
          mime: string | null
          project_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          filename: string
          height?: number | null
          id?: string
          mime?: string | null
          project_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          filename?: string
          height?: number | null
          id?: string
          mime?: string | null
          project_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_collections: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          project_id: string
          schema: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          project_id: string
          schema?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          project_id?: string
          schema?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_entries: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          locale: string
          project_id: string
          published_at: string | null
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          locale?: string
          project_id: string
          published_at?: string | null
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          locale?: string
          project_id?: string
          published_at?: string | null
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "cms_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          entry_id: string
          id: number
          note: string | null
          status_at_snapshot: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: Json
          entry_id: string
          id?: number
          note?: string | null
          status_at_snapshot?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          entry_id?: string
          id?: number
          note?: string | null
          status_at_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_revisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeats: {
        Row: {
          created_at: string
          id: string
          interval_minutes: number
          last_ping_at: string | null
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interval_minutes?: number
          last_ping_at?: string | null
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interval_minutes?: number
          last_ping_at?: string | null
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heartbeats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          date: string
          ingested_at: string
          metric: string
          project_id: string
          source: string
          value: number
        }
        Insert: {
          date: string
          ingested_at?: string
          metric: string
          project_id: string
          source: string
          value?: number
        }
        Update: {
          date?: string
          ingested_at?: string
          metric?: string
          project_id?: string
          source?: string
          value?: number
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
            foreignKeyName: "metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_country: {
        Row: {
          country_code: string
          date: string
          ingested_at: string
          metric: string
          project_id: string
          source: string
          value: number
        }
        Insert: {
          country_code: string
          date: string
          ingested_at?: string
          metric: string
          project_id: string
          source: string
          value?: number
        }
        Update: {
          country_code?: string
          date?: string
          ingested_at?: string
          metric?: string
          project_id?: string
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_country_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_country_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          arrival_date: string | null
          created_at: string
          currency: string
          fees: number | null
          gross: number | null
          id: string
          project_id: string | null
          source: string
          status: string
        }
        Insert: {
          amount: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          fees?: number | null
          gross?: number | null
          id: string
          project_id?: string | null
          source: string
          status: string
        }
        Update: {
          amount?: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          fees?: number | null
          gross?: number | null
          id?: string
          project_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      project_integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          project_id: string
          provider: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          project_id: string
          provider: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          project_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          app_store_country: string
          app_store_id: string | null
          brand_id: string
          cms_publish_targets: Json
          created_at: string
          enabled_modules: string[]
          google_play_country: string | null
          google_play_id: string | null
          id: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["property_type"]
        }
        Insert: {
          app_store_country?: string
          app_store_id?: string | null
          brand_id: string
          cms_publish_targets?: Json
          created_at?: string
          enabled_modules?: string[]
          google_play_country?: string | null
          google_play_id?: string | null
          id?: string
          name: string
          slug: string
          type?: Database["public"]["Enums"]["property_type"]
        }
        Update: {
          app_store_country?: string
          app_store_id?: string | null
          brand_id?: string
          cms_publish_targets?: Json
          created_at?: string
          enabled_modules?: string[]
          google_play_country?: string | null
          google_play_id?: string | null
          id?: string
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["property_type"]
        }
        Relationships: [
          {
            foreignKeyName: "properties_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_goals: {
        Row: {
          currency: string
          id: string
          month: string
          project_id: string | null
          target_amount: number
          updated_at: string
        }
        Insert: {
          currency?: string
          id?: string
          month: string
          project_id?: string | null
          target_amount: number
          updated_at?: string
        }
        Update: {
          currency?: string
          id?: string
          month?: string
          project_id?: string | null
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          app_version: string | null
          author: string | null
          body: string | null
          developer_response: string | null
          external_id: string | null
          fetched_at: string
          id: number
          project_id: string
          rating: number | null
          responded_at: string | null
          review_date: string | null
          source: string
          source_method: string | null
          territory: string | null
          title: string | null
        }
        Insert: {
          app_version?: string | null
          author?: string | null
          body?: string | null
          developer_response?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: never
          project_id: string
          rating?: number | null
          responded_at?: string | null
          review_date?: string | null
          source?: string
          source_method?: string | null
          territory?: string | null
          title?: string | null
        }
        Update: {
          app_version?: string | null
          author?: string | null
          body?: string | null
          developer_response?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: never
          project_id?: string
          rating?: number | null
          responded_at?: string | null
          review_date?: string | null
          source?: string
          source_method?: string | null
          territory?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          details: Json | null
          error_count: number
          finished_at: string | null
          id: number
          ingested: number
          ok_count: number
          started_at: string
          trigger: string
        }
        Insert: {
          details?: Json | null
          error_count?: number
          finished_at?: string | null
          id?: never
          ingested?: number
          ok_count?: number
          started_at?: string
          trigger?: string
        }
        Update: {
          details?: Json | null
          error_count?: number
          finished_at?: string | null
          id?: never
          ingested?: number
          ok_count?: number
          started_at?: string
          trigger?: string
        }
        Relationships: []
      }
      user_segments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string | null
          rule_days: number
          rule_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id?: string | null
          rule_days?: number
          rule_type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string | null
          rule_days?: number
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      projects: {
        Row: {
          app_store_country: string | null
          app_store_id: string | null
          created_at: string | null
          id: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          app_store_country?: string | null
          app_store_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          app_store_country?: string | null
          app_store_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      helm_cron_status: {
        Args: { limit_runs?: number }
        Returns: {
          active: boolean
          jobname: string
          last_runs: Json
          schedule: string
        }[]
      }
      set_revenue_goal: {
        Args: {
          p_currency?: string
          p_month: string
          p_project_id?: string
          p_target: number
        }
        Returns: {
          currency: string
          id: string
          month: string
          project_id: string | null
          target_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "revenue_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      property_type:
        | "website"
        | "web_app"
        | "mobile_app"
        | "desktop_app"
        | "game"
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
      property_type: [
        "website",
        "web_app",
        "mobile_app",
        "desktop_app",
        "game",
      ],
    },
  },
} as const
