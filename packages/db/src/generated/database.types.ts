export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null;
          id: string;
          metadata: Json;
          requested_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          metadata?: Json;
          requested_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          id?: string;
          metadata?: Json;
          requested_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      account_settings: {
        Row: {
          created_at: string;
          device_session_ttl_days: Database["public"]["Enums"]["device_session_ttl_days"];
          preferred_locale: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_session_ttl_days?: Database["public"]["Enums"]["device_session_ttl_days"];
          preferred_locale?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_session_ttl_days?: Database["public"]["Enums"]["device_session_ttl_days"];
          preferred_locale?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_checkout_sessions: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          interval: string;
          last_payload: Json | null;
          nowpayments_invoice_url: string | null;
          nowpayments_payment_id: string | null;
          order_id: string;
          payment_status: string | null;
          plan_id: string;
          provider: Database["public"]["Enums"]["billing_provider"];
          requested_interval: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency: string;
          id?: string;
          interval: string;
          last_payload?: Json | null;
          nowpayments_invoice_url?: string | null;
          nowpayments_payment_id?: string | null;
          order_id: string;
          payment_status?: string | null;
          plan_id: string;
          provider: Database["public"]["Enums"]["billing_provider"];
          requested_interval?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          interval?: string;
          last_payload?: Json | null;
          nowpayments_invoice_url?: string | null;
          nowpayments_payment_id?: string | null;
          order_id?: string;
          payment_status?: string | null;
          plan_id?: string;
          provider?: Database["public"]["Enums"]["billing_provider"];
          requested_interval?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_checkout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      device_sessions: {
        Row: {
          created_at: string;
          device_id: string;
          expires_at: string;
          id: string;
          last_seen_at: string | null;
          revoked_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          expires_at: string;
          id?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          expires_at?: string;
          id?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_sessions_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "device_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          browser_name: string | null;
          browser_version: string | null;
          created_at: string;
          device_name: string | null;
          extension_version: string | null;
          id: string;
          last_seen_at: string | null;
          locale: string | null;
          os: string | null;
          status: Database["public"]["Enums"]["device_status"];
          timezone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          browser_name?: string | null;
          browser_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          extension_version?: string | null;
          id?: string;
          last_seen_at?: string | null;
          locale?: string | null;
          os?: string | null;
          status?: Database["public"]["Enums"]["device_status"];
          timezone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          browser_name?: string | null;
          browser_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          extension_version?: string | null;
          id?: string;
          last_seen_at?: string | null;
          locale?: string | null;
          os?: string | null;
          status?: Database["public"]["Enums"]["device_status"];
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      extension_device_sessions: {
        Row: {
          created_at: string;
          device_id: string;
          id: string;
          last_seen_at: string | null;
          revoked_at: string | null;
          session_version: number;
          status: Database["public"]["Enums"]["extension_device_session_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          id?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          session_version?: number;
          status?: Database["public"]["Enums"]["extension_device_session_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          id?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          session_version?: number;
          status?: Database["public"]["Enums"]["extension_device_session_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extension_device_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_authorization_codes: {
        Row: {
          client_id: string;
          code_challenge: string;
          code_challenge_method: string;
          code_hash: string;
          created_at: string;
          device_id: string | null;
          expires_at: string;
          id: string;
          redirect_uri: string;
          scope: string | null;
          state: string | null;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          client_id: string;
          code_challenge: string;
          code_challenge_method?: string;
          code_hash: string;
          created_at?: string;
          device_id?: string | null;
          expires_at: string;
          id?: string;
          redirect_uri: string;
          scope?: string | null;
          state?: string | null;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          client_id?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          code_hash?: string;
          created_at?: string;
          device_id?: string | null;
          expires_at?: string;
          id?: string;
          redirect_uri?: string;
          scope?: string | null;
          state?: string | null;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_refresh_tokens: {
        Row: {
          client_id: string;
          created_at: string;
          device_session_id: string;
          expires_at: string;
          id: string;
          replaced_by_token_id: string | null;
          revoked_at: string | null;
          scope: string | null;
          token_hash: string;
          updated_at: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          device_session_id: string;
          expires_at: string;
          id?: string;
          replaced_by_token_id?: string | null;
          revoked_at?: string | null;
          scope?: string | null;
          token_hash: string;
          updated_at?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          device_session_id?: string;
          expires_at?: string;
          id?: string;
          replaced_by_token_id?: string | null;
          revoked_at?: string | null;
          scope?: string | null;
          token_hash?: string;
          updated_at?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_refresh_tokens_device_session_id_fkey";
            columns: ["device_session_id"];
            isOneToOne: false;
            referencedRelation: "extension_device_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oauth_refresh_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      polar_webhook_events: {
        Row: {
          error: string | null;
          id: string;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          status: Database["public"]["Enums"]["polar_webhook_event_status"];
          type: string;
          updated_at: string;
        };
        Insert: {
          error?: string | null;
          id: string;
          payload: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["polar_webhook_event_status"];
          type: string;
          updated_at?: string;
        };
        Update: {
          error?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["polar_webhook_event_status"];
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trails: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          device_id: string;
          id: string;
          label: string;
          label_source: Database["public"]["Enums"]["trail_label_source"];
          label_updated_at: string;
          node_count: number;
          payload: Json;
          root_favicon: string | null;
          root_title: string | null;
          root_url: string | null;
          saved_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          device_id: string;
          id?: string;
          label: string;
          label_source?: Database["public"]["Enums"]["trail_label_source"];
          label_updated_at: string;
          node_count: number;
          payload: Json;
          root_favicon?: string | null;
          root_title?: string | null;
          root_url?: string | null;
          saved_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          device_id?: string;
          id?: string;
          label?: string;
          label_source?: Database["public"]["Enums"]["trail_label_source"];
          label_updated_at?: string;
          node_count?: number;
          payload?: Json;
          root_favicon?: string | null;
          root_title?: string | null;
          root_url?: string | null;
          saved_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trails_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          interval: Database["public"]["Enums"]["subscription_interval"];
          pending_interval:
            | Database["public"]["Enums"]["subscription_interval"]
            | null;
          plan: Database["public"]["Enums"]["subscription_plan"];
          polar_customer_id: string | null;
          polar_subscription_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          interval?: Database["public"]["Enums"]["subscription_interval"];
          pending_interval?:
            | Database["public"]["Enums"]["subscription_interval"]
            | null;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          interval?: Database["public"]["Enums"]["subscription_interval"];
          pending_interval?:
            | Database["public"]["Enums"]["subscription_interval"]
            | null;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          auth_session_version: number;
          created_at: string;
          email: string;
          email_verified: boolean;
          id: string;
          image: string | null;
          image_url: string | null;
          name: string;
          onboarding_seen_at: string | null;
          updated_at: string;
        };
        Insert: {
          auth_session_version?: number;
          created_at?: string;
          email: string;
          email_verified?: boolean;
          id: string;
          image?: string | null;
          image_url?: string | null;
          name: string;
          onboarding_seen_at?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_session_version?: number;
          created_at?: string;
          email?: string;
          email_verified?: boolean;
          id?: string;
          image?: string | null;
          image_url?: string | null;
          name?: string;
          onboarding_seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlist_leads: {
        Row: {
          country: string | null;
          created_at: string;
          email: string;
          id: string;
          ip: string | null;
          page_path: string | null;
          referrer: string | null;
          sources: Database["public"]["Enums"]["wishlist_lead_source"][];
          updated_at: string;
          user_agent: string | null;
          user_id: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          ip?: string | null;
          page_path?: string | null;
          referrer?: string | null;
          sources?: Database["public"]["Enums"]["wishlist_lead_source"][];
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          ip?: string | null;
          page_path?: string | null;
          referrer?: string | null;
          sources?: Database["public"]["Enums"]["wishlist_lead_source"][];
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_leads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      request_account_deletion: { Args: never; Returns: string };
    };
    Enums: {
      billing_provider: "MANUAL" | "NOWPAYMENTS";
      device_session_ttl_days:
        | "DAYS_7"
        | "DAYS_30"
        | "DAYS_90"
        | "DAYS_180"
        | "DAYS_365";
      device_status: "ACTIVE" | "REVOKED";
      extension_device_session_status: "ACTIVE" | "REVOKED";
      polar_webhook_event_status:
        | "PENDING"
        | "PROCESSING"
        | "PROCESSED"
        | "FAILED";
      subscription_interval: "MONTH" | "YEAR";
      subscription_plan: "FREE" | "PRO" | "TEAMS";
      subscription_status:
        | "ACTIVE"
        | "TRIALING"
        | "PAST_DUE"
        | "CANCELED"
        | "UNPAID"
        | "INCOMPLETE"
        | "UNKNOWN";
      trail_label_source: "USER" | "AUTO" | "SYSTEM";
      wishlist_lead_source: "MARKETING" | "ACCOUNT" | "EXTENSION";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      billing_provider: ["MANUAL", "NOWPAYMENTS"],
      device_session_ttl_days: [
        "DAYS_7",
        "DAYS_30",
        "DAYS_90",
        "DAYS_180",
        "DAYS_365",
      ],
      device_status: ["ACTIVE", "REVOKED"],
      extension_device_session_status: ["ACTIVE", "REVOKED"],
      polar_webhook_event_status: [
        "PENDING",
        "PROCESSING",
        "PROCESSED",
        "FAILED",
      ],
      subscription_interval: ["MONTH", "YEAR"],
      subscription_plan: ["FREE", "PRO", "TEAMS"],
      subscription_status: [
        "ACTIVE",
        "TRIALING",
        "PAST_DUE",
        "CANCELED",
        "UNPAID",
        "INCOMPLETE",
        "UNKNOWN",
      ],
      trail_label_source: ["USER", "AUTO", "SYSTEM"],
      wishlist_lead_source: ["MARKETING", "ACCOUNT", "EXTENSION"],
    },
  },
} as const;
