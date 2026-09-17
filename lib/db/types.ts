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
      allocator_runs: {
        Row: {
          allocation: Json
          budget_usd: number
          id: string
          posterior: Json
          run_at: string
        }
        Insert: {
          allocation: Json
          budget_usd: number
          id?: string
          posterior: Json
          run_at?: string
        }
        Update: {
          allocation?: Json
          budget_usd?: number
          id?: string
          posterior?: Json
          run_at?: string
        }
        Relationships: []
      }
      attributions: {
        Row: {
          campaign_id: string
          customer_id: string
          id: string
          improved: boolean | null
          kit_registered: boolean
          order_at: string
          order_value: number
          retested: boolean
        }
        Insert: {
          campaign_id: string
          customer_id: string
          id?: string
          improved?: boolean | null
          kit_registered?: boolean
          order_at: string
          order_value: number
          retested?: boolean
        }
        Update: {
          campaign_id?: string
          customer_id?: string
          id?: string
          improved?: boolean | null
          kit_registered?: boolean
          order_at?: string
          order_value?: number
          retested?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_results: {
        Row: {
          flag: Database["public"]["Enums"]["flag"]
          id: string
          marker: Database["public"]["Enums"]["marker"]
          panel_id: string
          ref_high: number
          ref_low: number
          unit: string
          value: number
        }
        Insert: {
          flag: Database["public"]["Enums"]["flag"]
          id?: string
          marker: Database["public"]["Enums"]["marker"]
          panel_id: string
          ref_high: number
          ref_low: number
          unit: string
          value: number
        }
        Update: {
          flag?: Database["public"]["Enums"]["flag"]
          id?: string
          marker?: Database["public"]["Enums"]["marker"]
          panel_id?: string
          ref_high?: number
          ref_low?: number
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_results_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprints: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: Json
          created_at: string
          customer_id: string
          drafted_by: Database["public"]["Enums"]["actor"]
          id: string
          panel_id: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content: Json
          created_at?: string
          customer_id: string
          drafted_by: Database["public"]["Enums"]["actor"]
          id?: string
          panel_id: string
          status: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          customer_id?: string
          drafted_by?: Database["public"]["Enums"]["actor"]
          id?: string
          panel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprints_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          code: string
          creator_id: string
          id: string
          spend_usd: number
          start_at: string
          status: string
        }
        Insert: {
          code: string
          creator_id: string
          id?: string
          spend_usd?: number
          start_at: string
          status?: string
        }
        Update: {
          code?: string
          creator_id?: string
          id?: string
          spend_usd?: number
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          at: string
          customer_id: string
          id: string
          photo_quality_score: number | null
          severity_self_reported: number | null
        }
        Insert: {
          at: string
          customer_id: string
          id?: string
          photo_quality_score?: number | null
          severity_self_reported?: number | null
        }
        Update: {
          at?: string
          customer_id?: string
          id?: string
          photo_quality_score?: number | null
          severity_self_reported?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_cards: {
        Row: {
          approach_angle: string
          creator_id: string
          fit_reasoning: string
          fit_score: number
          generated_at: string
          model: string
          outreach_draft: string
          predicted_segment: Database["public"]["Enums"]["segment"]
          price_band_high: number
          price_band_low: number
          summary: string
        }
        Insert: {
          approach_angle: string
          creator_id: string
          fit_reasoning: string
          fit_score: number
          generated_at?: string
          model: string
          outreach_draft: string
          predicted_segment: Database["public"]["Enums"]["segment"]
          price_band_high: number
          price_band_low: number
          summary: string
        }
        Update: {
          approach_angle?: string
          creator_id?: string
          fit_reasoning?: string
          fit_score?: number
          generated_at?: string
          model?: string
          outreach_draft?: string
          predicted_segment?: Database["public"]["Enums"]["segment"]
          price_band_high?: number
          price_band_low?: number
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_cards_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avg_views: number | null
          bio: string | null
          data_status: Database["public"]["Enums"]["data_status"]
          display_name: string | null
          engagement_rate: number | null
          enriched_at: string | null
          external_id: string | null
          followers: number | null
          handle: string
          id: string
          platform: Database["public"]["Enums"]["platform"]
          recent_titles: Json | null
          source: string
          url: string
        }
        Insert: {
          avg_views?: number | null
          bio?: string | null
          data_status: Database["public"]["Enums"]["data_status"]
          display_name?: string | null
          engagement_rate?: number | null
          enriched_at?: string | null
          external_id?: string | null
          followers?: number | null
          handle: string
          id?: string
          platform: Database["public"]["Enums"]["platform"]
          recent_titles?: Json | null
          source: string
          url: string
        }
        Update: {
          avg_views?: number | null
          bio?: string | null
          data_status?: Database["public"]["Enums"]["data_status"]
          display_name?: string | null
          engagement_rate?: number | null
          enriched_at?: string | null
          external_id?: string | null
          followers?: number | null
          handle?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform"]
          recent_titles?: Json | null
          source?: string
          url?: string
        }
        Relationships: []
      }
      customer_segments: {
        Row: {
          computed_at: string
          confidence: number
          customer_id: string
          primary_segment: Database["public"]["Enums"]["segment"]
        }
        Insert: {
          computed_at?: string
          confidence: number
          customer_id: string
          primary_segment: Database["public"]["Enums"]["segment"]
        }
        Update: {
          computed_at?: string
          confidence?: number
          customer_id?: string
          primary_segment?: Database["public"]["Enums"]["segment"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          acquisition_channel: Database["public"]["Enums"]["channel"]
          age_band: Database["public"]["Enums"]["age_band"]
          consent_marketing: boolean
          consent_research: boolean
          created_at: string
          creator_code: string | null
          email_masked: string
          first_name: string
          id: string
          membership: Database["public"]["Enums"]["membership_status"]
          membership_months: number
          membership_started_at: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          region_state: string
          sex: Database["public"]["Enums"]["sex_type"]
        }
        Insert: {
          acquisition_channel: Database["public"]["Enums"]["channel"]
          age_band: Database["public"]["Enums"]["age_band"]
          consent_marketing?: boolean
          consent_research?: boolean
          created_at?: string
          creator_code?: string | null
          email_masked: string
          first_name: string
          id?: string
          membership?: Database["public"]["Enums"]["membership_status"]
          membership_months?: number
          membership_started_at?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          region_state: string
          sex: Database["public"]["Enums"]["sex_type"]
        }
        Update: {
          acquisition_channel?: Database["public"]["Enums"]["channel"]
          age_band?: Database["public"]["Enums"]["age_band"]
          consent_marketing?: boolean
          consent_research?: boolean
          created_at?: string
          creator_code?: string | null
          email_masked?: string
          first_name?: string
          id?: string
          membership?: Database["public"]["Enums"]["membership_status"]
          membership_months?: number
          membership_started_at?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          region_state?: string
          sex?: Database["public"]["Enums"]["sex_type"]
        }
        Relationships: []
      }
      interventions: {
        Row: {
          customer_id: string
          ended_at: string | null
          id: string
          sku: string
          started_at: string
          type: Database["public"]["Enums"]["intervention_type"]
        }
        Insert: {
          customer_id: string
          ended_at?: string | null
          id?: string
          sku: string
          started_at: string
          type: Database["public"]["Enums"]["intervention_type"]
        }
        Update: {
          customer_id?: string
          ended_at?: string | null
          id?: string
          sku?: string
          started_at?: string
          type?: Database["public"]["Enums"]["intervention_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interventions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_events: {
        Row: {
          actor: Database["public"]["Enums"]["actor"]
          at: string
          from_state: Database["public"]["Enums"]["kit_state"] | null
          id: string
          kit_id: string
          note: string | null
          to_state: Database["public"]["Enums"]["kit_state"]
        }
        Insert: {
          actor: Database["public"]["Enums"]["actor"]
          at?: string
          from_state?: Database["public"]["Enums"]["kit_state"] | null
          id?: string
          kit_id: string
          note?: string | null
          to_state: Database["public"]["Enums"]["kit_state"]
        }
        Update: {
          actor?: Database["public"]["Enums"]["actor"]
          at?: string
          from_state?: Database["public"]["Enums"]["kit_state"] | null
          id?: string
          kit_id?: string
          note?: string | null
          to_state?: Database["public"]["Enums"]["kit_state"]
        }
        Relationships: [
          {
            foreignKeyName: "kit_events_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          kit_code: string
          sequence_no: number
          state: Database["public"]["Enums"]["kit_state"]
          state_entered_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          kit_code: string
          sequence_no?: number
          state?: Database["public"]["Enums"]["kit_state"]
          state_entered_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          kit_code?: string
          sequence_no?: number
          state?: Database["public"]["Enums"]["kit_state"]
          state_entered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          baseline_panel_id: string
          computed_at: string
          customer_id: string
          improved: boolean
          markers_improved: number
          retest_panel_id: string
          severity_delta: number
        }
        Insert: {
          baseline_panel_id: string
          computed_at?: string
          customer_id: string
          improved: boolean
          markers_improved: number
          retest_panel_id: string
          severity_delta: number
        }
        Update: {
          baseline_panel_id?: string
          computed_at?: string
          customer_id?: string
          improved?: boolean
          markers_improved?: number
          retest_panel_id?: string
          severity_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_baseline_panel_id_fkey"
            columns: ["baseline_panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_retest_panel_id_fkey"
            columns: ["retest_panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
        ]
      }
      panels: {
        Row: {
          collected_at: string
          customer_id: string
          id: string
          kit_id: string
          resulted_at: string
          sequence_no: number
        }
        Insert: {
          collected_at: string
          customer_id: string
          id?: string
          kit_id: string
          resulted_at: string
          sequence_no: number
        }
        Update: {
          collected_at?: string
          customer_id?: string
          id?: string
          kit_id?: string
          resulted_at?: string
          sequence_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "panels_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_actions: {
        Row: {
          created_at: string
          customer_id: string
          decided_at: string | null
          id: string
          payload: Json
          proposed_by: string
          status: Database["public"]["Enums"]["action_status"]
          type: Database["public"]["Enums"]["action_type"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          decided_at?: string | null
          id?: string
          payload: Json
          proposed_by: string
          status?: Database["public"]["Enums"]["action_status"]
          type: Database["public"]["Enums"]["action_type"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          decided_at?: string | null
          id?: string
          payload?: Json
          proposed_by?: string
          status?: Database["public"]["Enums"]["action_status"]
          type?: Database["public"]["Enums"]["action_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          name: string
        }
        Insert: {
          applied_at?: string
          name: string
        }
        Update: {
          applied_at?: string
          name?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      tickets: {
        Row: {
          ai_summary: Json | null
          body: string
          channel: string
          customer_id: string
          id: string
          kit_id: string | null
          likely_cause: Database["public"]["Enums"]["likely_cause"] | null
          opened_at: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Insert: {
          ai_summary?: Json | null
          body: string
          channel: string
          customer_id: string
          id?: string
          kit_id?: string | null
          likely_cause?: Database["public"]["Enums"]["likely_cause"] | null
          opened_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Update: {
          ai_summary?: Json | null
          body?: string
          channel?: string
          customer_id?: string
          id?: string
          kit_id?: string | null
          likely_cause?: Database["public"]["Enums"]["likely_cause"] | null
          opened_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copilot_explain_query: { Args: { query: string }; Returns: Json }
      copilot_run_readonly_query: { Args: { query: string }; Returns: Json }
      reset_synthetic_data: { Args: never; Returns: undefined }
    }
    Enums: {
      action_status: "proposed" | "confirmed" | "rejected"
      action_type: "nudge_sms" | "nudge_email" | "ticket_note"
      actor: "system" | "staff" | "customer" | "lab"
      age_band: "16-19" | "20-24" | "25-34" | "35-44" | "45+"
      channel:
        | "instagram"
        | "youtube"
        | "tiktok"
        | "search"
        | "referral"
        | "direct"
      data_status: "live" | "seeded"
      flag: "low" | "optimal" | "high"
      intervention_type: "supplement" | "skincare" | "rx" | "lifestyle"
      kit_state:
        | "ordered"
        | "backordered"
        | "shipped"
        | "delivered"
        | "registered"
        | "registration_mismatch"
        | "sample_received"
        | "resulted"
        | "results_locked"
        | "blueprint_ready"
        | "viewed"
        | "checkin_active"
        | "retest_due"
        | "retest_ordered"
        | "cancelled"
        | "refunded"
      likely_cause:
        | "unlinked_kit"
        | "portal_lockout"
        | "backorder"
        | "shipping_delay"
        | "billing"
        | "registration_mismatch"
        | "refund_request"
        | "clinical_question"
        | "other"
      marker:
        | "testosterone"
        | "dhea_s"
        | "shbg"
        | "cortisol"
        | "insulin"
        | "vitamin_d"
        | "zinc"
        | "hs_crp"
      membership_status: "none" | "active" | "cancelled"
      plan_type: "standalone" | "membership_first" | "study"
      platform: "youtube" | "instagram" | "tiktok"
      segment:
        | "androgen"
        | "insulin"
        | "cortisol"
        | "nutrient"
        | "inflammation"
        | "mixed"
      sex_type: "female" | "male" | "other"
      ticket_status: "open" | "pending_customer" | "resolved"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      action_status: ["proposed", "confirmed", "rejected"],
      action_type: ["nudge_sms", "nudge_email", "ticket_note"],
      actor: ["system", "staff", "customer", "lab"],
      age_band: ["16-19", "20-24", "25-34", "35-44", "45+"],
      channel: [
        "instagram",
        "youtube",
        "tiktok",
        "search",
        "referral",
        "direct",
      ],
      data_status: ["live", "seeded"],
      flag: ["low", "optimal", "high"],
      intervention_type: ["supplement", "skincare", "rx", "lifestyle"],
      kit_state: [
        "ordered",
        "backordered",
        "shipped",
        "delivered",
        "registered",
        "registration_mismatch",
        "sample_received",
        "resulted",
        "results_locked",
        "blueprint_ready",
        "viewed",
        "checkin_active",
        "retest_due",
        "retest_ordered",
        "cancelled",
        "refunded",
      ],
      likely_cause: [
        "unlinked_kit",
        "portal_lockout",
        "backorder",
        "shipping_delay",
        "billing",
        "registration_mismatch",
        "refund_request",
        "clinical_question",
        "other",
      ],
      marker: [
        "testosterone",
        "dhea_s",
        "shbg",
        "cortisol",
        "insulin",
        "vitamin_d",
        "zinc",
        "hs_crp",
      ],
      membership_status: ["none", "active", "cancelled"],
      plan_type: ["standalone", "membership_first", "study"],
      platform: ["youtube", "instagram", "tiktok"],
      segment: [
        "androgen",
        "insulin",
        "cortisol",
        "nutrient",
        "inflammation",
        "mixed",
      ],
      sex_type: ["female", "male", "other"],
      ticket_status: ["open", "pending_customer", "resolved"],
    },
  },
} as const
