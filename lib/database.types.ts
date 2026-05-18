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
      projects: {
        Row: {
          public_id: string;
          name: string;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          public_id: string;
          name?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          public_id?: string;
          name?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
