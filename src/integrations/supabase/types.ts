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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          equipment: string
          family: string
          id: string
          muscle_group: string
          name: string
          primary_muscles: string[]
          secondary_muscles: string[]
          slug: string
          steps: string[]
        }
        Insert: {
          equipment: string
          family: string
          id?: string
          muscle_group: string
          name: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          slug: string
          steps?: string[]
        }
        Update: {
          equipment?: string
          family?: string
          id?: string
          muscle_group?: string
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          slug?: string
          steps?: string[]
        }
        Relationships: []
      }
      product_aliases: {
        Row: {
          category: string
          created_at: string
          default_location_kind: string | null
          default_quantity: number | null
          default_unit: string
          icon: string | null
          id: string
          product_name: string
          raw_text: string
          store: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_location_kind?: string | null
          default_quantity?: number | null
          default_unit?: string
          icon?: string | null
          id?: string
          product_name: string
          raw_text: string
          store?: string | null
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_location_kind?: string | null
          default_quantity?: number | null
          default_unit?: string
          icon?: string | null
          id?: string
          product_name?: string
          raw_text?: string
          store?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          experience: string | null
          goal: string | null
          height_cm: number | null
          id: string
          onboarded: boolean
          sessions_per_week: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          experience?: string | null
          goal?: string | null
          height_cm?: number | null
          id: string
          onboarded?: boolean
          sessions_per_week?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          experience?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          onboarded?: boolean
          sessions_per_week?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          servings: number
          source: string
          steps: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          servings?: number
          source?: string
          steps?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          servings?: number
          source?: string
          steps?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          pantry_item_id: string | null
          position: number
          quantity: number
          recipe_id: string
          unit: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          pantry_item_id?: string | null
          position?: number
          quantity?: number
          recipe_id: string
          unit?: string
          user_id?: string
        }
        Update: {
          id?: string
          name?: string
          pantry_item_id?: string | null
          position?: number
          quantity?: number
          recipe_id?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_sessions: {
        Row: {
          date: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          exercise_id: string
          id: string
          position: number
          reps: string
          session_id: string
          sets: number
          user_id: string
          weight_kg: number | null
          weight_note: string | null
        }
        Insert: {
          exercise_id: string
          id?: string
          position?: number
          reps?: string
          session_id: string
          sets?: number
          user_id: string
          weight_kg?: number | null
          weight_note?: string | null
        }
        Update: {
          exercise_id?: string
          id?: string
          position?: number
          reps?: string
          session_id?: string
          sets?: number
          user_id?: string
          weight_kg?: number | null
          weight_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      cooked_log: {
        Row: {
          carbs_g: number | null
          cooked_at: string
          fat_g: number | null
          id: string
          kcal: number | null
          kcal_missing: number
          portions: number | null
          protein_g: number | null
          recipe_id: string | null
          removed: Json
          servings: number
          title: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          cooked_at?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          kcal_missing?: number
          portions?: number | null
          protein_g?: number | null
          recipe_id?: string | null
          removed?: Json
          servings: number
          title: string
          undone_at?: string | null
          user_id?: string
        }
        Update: {
          carbs_g?: number | null
          cooked_at?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          kcal_missing?: number
          portions?: number | null
          protein_g?: number | null
          recipe_id?: string | null
          removed?: Json
          servings?: number
          title?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ingredient_nutrition: {
        Row: {
          basis: string
          carbs_g: number | null
          fat_g: number | null
          id: string
          kcal: number
          name: string
          protein_g: number
          source: string
          user_id: string
        }
        Insert: {
          basis: string
          carbs_g?: number | null
          fat_g?: number | null
          id?: string
          kcal: number
          name: string
          protein_g: number
          source?: string
          user_id?: string
        }
        Update: {
          basis?: string
          carbs_g?: number | null
          fat_g?: number | null
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      kitchen_layouts: {
        Row: {
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          layout: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kitchen_zones: {
        Row: {
          created_at: string
          height: number
          id: string
          kind: string
          location_id: string | null
          name: string
          parent_id: string | null
          position: number
          user_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          height: number
          id?: string
          kind?: string
          location_id?: string | null
          name: string
          parent_id?: string | null
          position?: number
          user_id?: string
          width: number
          x: number
          y: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          kind?: string
          location_id?: string | null
          name?: string
          parent_id?: string | null
          position?: number
          user_id?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          added_at: string
          category: string
          expires_on: string | null
          icon: string | null
          id: string
          location_id: string | null
          name: string
          note: string | null
          quantity: number
          shelf: number | null
          unit: string
          user_id: string
        }
        Insert: {
          added_at?: string
          category?: string
          expires_on?: string | null
          icon?: string | null
          id?: string
          location_id?: string | null
          name: string
          note?: string | null
          quantity?: number
          shelf?: number | null
          unit?: string
          user_id?: string
        }
        Update: {
          added_at?: string
          category?: string
          expires_on?: string | null
          icon?: string | null
          id?: string
          location_id?: string | null
          name?: string
          note?: string | null
          quantity?: number
          shelf?: number | null
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_categories: {
        Row: {
          created_at: string
          key: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          key: string
          label: string
          user_id?: string
        }
        Update: {
          created_at?: string
          key?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_locations: {
        Row: {
          accepts: string[]
          created_at: string
          id: string
          kind: string
          name: string
          parent_id: string | null
          position: number
          user_id: string
        }
        Insert: {
          accepts?: string[]
          created_at?: string
          id?: string
          kind?: string
          name: string
          parent_id?: string | null
          position?: number
          user_id?: string
        }
        Update: {
          accepts?: string[]
          created_at?: string
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      pantry_settings: {
        Row: {
          ai_check: boolean
          ai_lines_sent: number
          ai_recipe_requests: number
          ai_recipes: boolean
          ai_chat: boolean
          ai_chat_requests: number
          aliases_seed_version: number
          aliases_seeded: boolean
          layout_upgraded: boolean
          kitchen_seeded: boolean
          locations_seeded: boolean
          nutrition_seeded: boolean
          user_id: string
        }
        Insert: {
          ai_check?: boolean
          ai_lines_sent?: number
          ai_recipe_requests?: number
          ai_recipes?: boolean
          ai_chat?: boolean
          ai_chat_requests?: number
          aliases_seed_version?: number
          aliases_seeded?: boolean
          layout_upgraded?: boolean
          kitchen_seeded?: boolean
          locations_seeded?: boolean
          nutrition_seeded?: boolean
          user_id?: string
        }
        Update: {
          ai_check?: boolean
          ai_lines_sent?: number
          ai_recipe_requests?: number
          ai_recipes?: boolean
          ai_chat?: boolean
          ai_chat_requests?: number
          aliases_seed_version?: number
          aliases_seeded?: boolean
          layout_upgraded?: boolean
          kitchen_seeded?: boolean
          locations_seeded?: boolean
          nutrition_seeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          created_at: string
          done: boolean
          id: string
          name: string
          quantity: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          name: string
          quantity?: number | null
          unit?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          name?: string
          quantity?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      body_weight_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          user_id?: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          finished_at: string
          id: string
          session_id: string | null
          session_name: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string
          id?: string
          session_id?: string | null
          session_name: string
          started_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          finished_at?: string
          id?: string
          session_id?: string | null
          session_name?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          done: boolean
          exercise_id: string
          id: string
          log_id: string
          planned_reps: string | null
          planned_weight_kg: number | null
          position: number
          reps: number | null
          set_number: number
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          done?: boolean
          exercise_id: string
          id?: string
          log_id: string
          planned_reps?: string | null
          planned_weight_kg?: number | null
          position?: number
          reps?: number | null
          set_number: number
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          done?: boolean
          exercise_id?: string
          id?: string
          log_id?: string
          planned_reps?: string | null
          planned_weight_kg?: number | null
          position?: number
          reps?: number | null
          set_number?: number
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cook_recipe: {
        Args: {
          p_carbs_g?: number | null
          p_changes: Json
          p_fat_g?: number | null
          p_kcal: number | null
          p_kcal_missing: number
          p_portions?: number | null
          p_protein_g: number | null
          p_recipe_id: string | null
          p_servings: number
          p_title: string
        }
        Returns: string
      }
      seed_example_plan: { Args: never; Returns: undefined }
      undo_cook: { Args: { p_log_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
