// Database types for Supabase. Keep in sync with supabase/migrations/*.
// Written by hand (not generated) — when adding a column, update Row + Insert + Update.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: "owner" | "editor" | "viewer";
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_project_member: {
        Args: { p_project_id: string; p_user_id: string };
        Returns: boolean;
      };
      has_project_role: {
        Args: {
          p_project_id: string;
          p_user_id: string;
          p_min_role: "owner" | "editor" | "viewer";
        };
        Returns: boolean;
      };
      find_user_id_by_email: {
        Args: { p_email: string };
        Returns: string | null;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
