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
      appointment_items: {
        Row: {
          appointment_id: string
          blocks: number
          id: string
          price: number
          procedure_id: string
          procedure_name: string
        }
        Insert: {
          appointment_id: string
          blocks: number
          id?: string
          price: number
          procedure_id: string
          procedure_name: string
        }
        Update: {
          appointment_id?: string
          blocks?: number
          id?: string
          price?: number
          procedure_id?: string
          procedure_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
          created_at: string
          group_id: string | null
          id: string
          notes: string | null
          professional_id: string
          promotion_id: string | null
          scheduled_date: string
          start_block: number
          status: Database["public"]["Enums"]["appointment_status"]
          total_blocks: number
          total_price: number
        }
        Insert: {
          client_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          professional_id: string
          promotion_id?: string | null
          scheduled_date: string
          start_block: number
          status?: Database["public"]["Enums"]["appointment_status"]
          total_blocks: number
          total_price?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          professional_id?: string
          promotion_id?: string | null
          scheduled_date?: string
          start_block?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          total_blocks?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          by_length: boolean
          category: Database["public"]["Enums"]["procedure_category"]
          created_at: string
          description: string | null
          duration_blocks: number
          id: string
          is_active: boolean
          name: string
          price: number
          price_long: number | null
          price_medium: number | null
          price_short: number | null
          price_xlong: number | null
        }
        Insert: {
          by_length?: boolean
          category?: Database["public"]["Enums"]["procedure_category"]
          created_at?: string
          description?: string | null
          duration_blocks: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          price_long?: number | null
          price_medium?: number | null
          price_short?: number | null
          price_xlong?: number | null
        }
        Update: {
          by_length?: boolean
          category?: Database["public"]["Enums"]["procedure_category"]
          created_at?: string
          description?: string | null
          duration_blocks?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          price_long?: number | null
          price_medium?: number | null
          price_short?: number | null
          price_xlong?: number | null
        }
        Relationships: []
      }
      professional_days_off: {
        Row: {
          created_at: string
          day: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      professional_schedules: {
        Row: {
          end_block: number
          lunch_end_block: number | null
          lunch_start_block: number | null
          start_block: number
          updated_at: string
          user_id: string
        }
        Insert: {
          end_block?: number
          lunch_end_block?: number | null
          lunch_start_block?: number | null
          start_block?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          end_block?: number
          lunch_end_block?: number | null
          lunch_start_block?: number | null
          start_block?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          photo_url: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      promotion_procedures: {
        Row: {
          procedure_id: string
          promotion_id: string
        }
        Insert: {
          procedure_id: string
          promotion_id: string
        }
        Update: {
          procedure_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_procedures_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number
          end_date: string
          id: string
          name: string
          original_price: number
          promo_price: number
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent: number
          end_date: string
          id?: string
          name: string
          original_price: number
          promo_price: number
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number
          end_date?: string
          id?: string
          name?: string
          original_price?: number
          promo_price?: number
          start_date?: string
        }
        Relationships: []
      }
      salon_settings: {
        Row: {
          address: string | null
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          name: string
          phone: string | null
          tagline: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name?: string
          phone?: string | null
          tagline?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name?: string
          phone?: string | null
          tagline?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status: "confirmed" | "cancelled" | "completed"
      procedure_category: "cabelo" | "unhas" | "estetica" | "outros"
      user_role: "admin" | "hairdresser" | "manicurist"
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
      appointment_status: ["confirmed", "cancelled", "completed"],
      procedure_category: ["cabelo", "unhas", "estetica", "outros"],
      user_role: ["admin", "hairdresser", "manicurist"],
    },
  },
} as const
