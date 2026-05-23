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
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
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
          share_token: string | null;
          primary_currency: string;
          secondary_currency: string | null;
          manual_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          payload?: Json;
          share_token?: string | null;
          primary_currency?: string;
          secondary_currency?: string | null;
          manual_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          payload?: Json;
          share_token?: string | null;
          primary_currency?: string;
          secondary_currency?: string | null;
          manual_rate?: number | null;
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
      exchange_rates_cache: {
        Row: {
          base: string;
          target: string;
          rate: number;
          fetched_at: string;
        };
        Insert: {
          base: string;
          target: string;
          rate: number;
          fetched_at?: string;
        };
        Update: {
          base?: string;
          target?: string;
          rate?: number;
          fetched_at?: string;
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
      transfer_project_ownership: {
        Args: { p_project_id: string; p_to_user_id: string };
        Returns: undefined;
      };
      create_app_project: {
        Args: {
          p_name?: string;
          p_primary_currency?: string;
          p_secondary_currency?: string | null;
        };
        Returns: string;
      };
      get_public_project_summary: {
        Args: { p_token: string };
        Returns: {
          name: string;
          payload: Json;
          primary_currency: string;
          secondary_currency: string | null;
          updated_at: string;
        }[];
      };
      upsert_exchange_rate: {
        Args: { p_base: string; p_target: string; p_rate: number };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
