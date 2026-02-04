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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      document_entities: {
        Row: {
          created_at: string
          data: Json
          document_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          document_id: string
          entity_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          document_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_entity_refs: {
        Row: {
          created_at: string
          document_id: string
          entity_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          entity_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          entity_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_entity_refs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_entity_refs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json | null
          created_at: string
          hierarchy_blocks: Json | null
          id: string
          is_master: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          hierarchy_blocks?: Json | null
          id?: string
          is_master?: boolean | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          hierarchy_blocks?: Json | null
          id?: string
          is_master?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          data: Json
          entity_type: string
          id: string
          owner_id: string
          source_document_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["entity_visibility"]
        }
        Insert: {
          created_at?: string
          data?: Json
          entity_type: string
          id?: string
          owner_id: string
          source_document_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["entity_visibility"]
        }
        Update: {
          created_at?: string
          data?: Json
          entity_type?: string
          id?: string
          owner_id?: string
          source_document_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["entity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "entities_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          created_at: string
          id: string
          source_entity_id: string
          target_entity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_entity_id: string
          target_entity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_entity_id?: string
          target_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_links_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "document_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_links_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "document_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_permissions: {
        Row: {
          created_at: string
          entity_id: string
          granted_by_user_id: string
          granted_to_user_id: string
          id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          granted_by_user_id: string
          granted_to_user_id: string
          id?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          granted_by_user_id?: string
          granted_to_user_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_permissions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relationships: {
        Row: {
          created_at: string
          description: string | null
          id: string
          relationship_type: string
          source_entity_id: string
          target_entity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          relationship_type: string
          source_entity_id: string
          target_entity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          relationship_type?: string
          source_entity_id?: string
          target_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "document_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "document_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          category: string | null
          created_at: string
          document_id: string | null
          id: string
          items_generated: number | null
          prompt: string
          terms_extracted: number | null
          title: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          items_generated?: number | null
          prompt: string
          terms_extracted?: number | null
          title?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          items_generated?: number | null
          prompt?: string
          terms_extracted?: number | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      public_entities: {
        Row: {
          category: string | null
          entity_id: string
          id: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          submitted_at: string
          submitted_by_user_id: string
          tags: string[] | null
        }
        Insert: {
          category?: string | null
          entity_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          submitted_at?: string
          submitted_by_user_id: string
          tags?: string[] | null
        }
        Update: {
          category?: string | null
          entity_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          submitted_at?: string
          submitted_by_user_id?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "public_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_descend: boolean
          auto_save: boolean
          created_at: string
          font_size: string
          id: string
          page_width: string
          show_row_highlight: boolean
          show_slash_placeholder: boolean
          start_with_outline: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_descend?: boolean
          auto_save?: boolean
          created_at?: string
          font_size?: string
          id?: string
          page_width?: string
          show_row_highlight?: boolean
          show_slash_placeholder?: boolean
          start_with_outline?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_descend?: boolean
          auto_save?: boolean
          created_at?: string
          font_size?: string
          id?: string
          page_width?: string
          show_row_highlight?: boolean
          show_slash_placeholder?: boolean
          start_with_outline?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_style_preferences: {
        Row: {
          created_at: string
          current_mixed_config: Json | null
          custom_styles: Json
          default_style_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_mixed_config?: Json | null
          custom_styles?: Json
          default_style_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_mixed_config?: Json | null
          custom_styles?: Json
          default_style_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_entities: {
        Row: {
          added_by_user_id: string
          created_at: string
          entity_id: string
          id: string
          workspace_id: string
        }
        Insert: {
          added_by_user_id: string
          created_at?: string
          entity_id: string
          id?: string
          workspace_id: string
        }
        Update: {
          added_by_user_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_entity: {
        Args: { _entity_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_entity_owner: {
        Args: { _entity_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      entity_status: "draft" | "pending" | "approved" | "rejected"
      entity_visibility: "private" | "workspace" | "public"
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
      app_role: ["admin", "moderator", "user"],
      entity_status: ["draft", "pending", "approved", "rejected"],
      entity_visibility: ["private", "workspace", "public"],
    },
  },
} as const
