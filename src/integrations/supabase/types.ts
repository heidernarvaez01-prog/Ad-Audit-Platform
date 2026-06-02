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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_records: {
        Row: {
          account_id: string
          campaign_name: string
          created_at: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          platform: string | null
          presupuesto_total: number
          tipo_calendario: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          campaign_name: string
          created_at?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          platform?: string | null
          presupuesto_total?: number
          tipo_calendario?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          campaign_name?: string
          created_at?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          platform?: string | null
          presupuesto_total?: number
          tipo_calendario?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_briefs: {
        Row: {
          account_id: string
          account_name: string | null
          benchmark: string | null
          created_at: string
          descripcion_proyecto: string | null
          diferenciador: string | null
          elementos_marca: string | null
          estilo_tono: string | null
          frases_marca: string | null
          fundamentos_marca: string | null
          id: string
          insights: string | null
          marca: string | null
          mercado_objetivo: string | null
          necesidad_principal: string | null
          palabras_marca: string | null
          personalidad_marca: string | null
          presupuesto_campana: number | null
          promesa_marca: string | null
          publico_objetivo: string | null
          reasons_why: string | null
          sitio_web: string | null
          updated_at: string
          user_id: string
          valores_marca: string | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          benchmark?: string | null
          created_at?: string
          descripcion_proyecto?: string | null
          diferenciador?: string | null
          elementos_marca?: string | null
          estilo_tono?: string | null
          frases_marca?: string | null
          fundamentos_marca?: string | null
          id?: string
          insights?: string | null
          marca?: string | null
          mercado_objetivo?: string | null
          necesidad_principal?: string | null
          palabras_marca?: string | null
          personalidad_marca?: string | null
          presupuesto_campana?: number | null
          promesa_marca?: string | null
          publico_objetivo?: string | null
          reasons_why?: string | null
          sitio_web?: string | null
          updated_at?: string
          user_id: string
          valores_marca?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          benchmark?: string | null
          created_at?: string
          descripcion_proyecto?: string | null
          diferenciador?: string | null
          elementos_marca?: string | null
          estilo_tono?: string | null
          frases_marca?: string | null
          fundamentos_marca?: string | null
          id?: string
          insights?: string | null
          marca?: string | null
          mercado_objetivo?: string | null
          necesidad_principal?: string | null
          palabras_marca?: string | null
          personalidad_marca?: string | null
          presupuesto_campana?: number | null
          promesa_marca?: string | null
          publico_objetivo?: string | null
          reasons_why?: string | null
          sitio_web?: string | null
          updated_at?: string
          user_id?: string
          valores_marca?: string | null
        }
        Relationships: []
      }
      campaign_tracking: {
        Row: {
          account_name: string | null
          budget_approved: number
          campaign_name: string
          created_at: string
          end_date: string
          id: string
          lab_days: Database["public"]["Enums"]["lab_days_type"]
          platform: Database["public"]["Enums"]["ad_platform"]
          programmed_budget: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          budget_approved?: number
          campaign_name: string
          created_at?: string
          end_date: string
          id?: string
          lab_days?: Database["public"]["Enums"]["lab_days_type"]
          platform: Database["public"]["Enums"]["ad_platform"]
          programmed_budget?: number
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          budget_approved?: number
          campaign_name?: string
          created_at?: string
          end_date?: string
          id?: string
          lab_days?: Database["public"]["Enums"]["lab_days_type"]
          platform?: Database["public"]["Enums"]["ad_platform"]
          programmed_budget?: number
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          created_at: string
          csv_url: string
          id: string
          is_valid: boolean | null
          last_validated_at: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csv_url: string
          id?: string
          is_valid?: boolean | null
          last_validated_at?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csv_url?: string
          id?: string
          is_valid?: boolean | null
          last_validated_at?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_datos: {
        Row: {
          account_id: string | null
          account_name: string | null
          adset_daily_budget: number | null
          adset_end_date: string | null
          adset_lifetime_budget: number | null
          adset_name: string | null
          adset_start_date: string | null
          budget_remaining: number | null
          campaign_end_date: string | null
          campaign_lifetime_budget: number | null
          campaign_name: string | null
          campaign_start_date: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr_all: number | null
          daily_budget: number | null
          fecha: string | null
          frequency: number | null
          id: number
          impressions: number | null
          objective: string | null
          plataforma: string | null
          reach: number | null
          thruplay_actions: number | null
          total_cost: number | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          adset_daily_budget?: number | null
          adset_end_date?: string | null
          adset_lifetime_budget?: number | null
          adset_name?: string | null
          adset_start_date?: string | null
          budget_remaining?: number | null
          campaign_end_date?: string | null
          campaign_lifetime_budget?: number | null
          campaign_name?: string | null
          campaign_start_date?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr_all?: number | null
          daily_budget?: number | null
          fecha?: string | null
          frequency?: number | null
          id?: number
          impressions?: number | null
          objective?: string | null
          plataforma?: string | null
          reach?: number | null
          thruplay_actions?: number | null
          total_cost?: number | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          adset_daily_budget?: number | null
          adset_end_date?: string | null
          adset_lifetime_budget?: number | null
          adset_name?: string | null
          adset_start_date?: string | null
          budget_remaining?: number | null
          campaign_end_date?: string | null
          campaign_lifetime_budget?: number | null
          campaign_name?: string | null
          campaign_start_date?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr_all?: number | null
          daily_budget?: number | null
          fecha?: string | null
          frequency?: number | null
          id?: number
          impressions?: number | null
          objective?: string | null
          plataforma?: string | null
          reach?: number | null
          thruplay_actions?: number | null
          total_cost?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ad_platform:
        | "meta"
        | "google"
        | "tiktok"
        | "linkedin"
        | "extra1"
        | "extra2"
      lab_days_type: "mon_fri" | "mon_sat" | "all"
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
      ad_platform: ["meta", "google", "tiktok", "linkedin", "extra1", "extra2"],
      lab_days_type: ["mon_fri", "mon_sat", "all"],
    },
  },
} as const
