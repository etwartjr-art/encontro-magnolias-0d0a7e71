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
      greenn_webhook_logs: {
        Row: {
          criado_em: string
          erro: string | null
          event_hash: string | null
          greenn_sale_id: string | null
          id: string
          inscricao_id: string | null
          payload: Json
          processado: boolean
          status_mapeado: Database["public"]["Enums"]["inscricao_status"] | null
          status_recebido: string | null
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          event_hash?: string | null
          greenn_sale_id?: string | null
          id?: string
          inscricao_id?: string | null
          payload: Json
          processado?: boolean
          status_mapeado?:
            | Database["public"]["Enums"]["inscricao_status"]
            | null
          status_recebido?: string | null
        }
        Update: {
          criado_em?: string
          erro?: string | null
          event_hash?: string | null
          greenn_sale_id?: string | null
          id?: string
          inscricao_id?: string | null
          payload?: Json
          processado?: boolean
          status_mapeado?:
            | Database["public"]["Enums"]["inscricao_status"]
            | null
          status_recebido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "greenn_webhook_logs_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      inscricoes: {
        Row: {
          atualizado_em: string
          celular: string
          criado_em: string
          email: string
          greenn_payload: Json | null
          greenn_sale_id: string | null
          id: string
          metodo_pagamento: string | null
          nome: string
          pago_em: string | null
          status: Database["public"]["Enums"]["inscricao_status"]
          valor: number
        }
        Insert: {
          atualizado_em?: string
          celular: string
          criado_em?: string
          email: string
          greenn_payload?: Json | null
          greenn_sale_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          nome: string
          pago_em?: string | null
          status?: Database["public"]["Enums"]["inscricao_status"]
          valor?: number
        }
        Update: {
          atualizado_em?: string
          celular?: string
          criado_em?: string
          email?: string
          greenn_payload?: Json | null
          greenn_sale_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          nome?: string
          pago_em?: string | null
          status?: Database["public"]["Enums"]["inscricao_status"]
          valor?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          prayer_request: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone: string
          prayer_request?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          prayer_request?: string | null
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          atualizadas: number
          criadas: number
          detalhes: Json | null
          duracao_ms: number | null
          erro_mensagem: string | null
          erros: number
          finalizado_em: string | null
          http_status: number | null
          id: string
          ignoradas: number
          iniciado_em: string
          origem: string
          sucesso: boolean
          total: number
        }
        Insert: {
          atualizadas?: number
          criadas?: number
          detalhes?: Json | null
          duracao_ms?: number | null
          erro_mensagem?: string | null
          erros?: number
          finalizado_em?: string | null
          http_status?: number | null
          id?: string
          ignoradas?: number
          iniciado_em?: string
          origem?: string
          sucesso?: boolean
          total?: number
        }
        Update: {
          atualizadas?: number
          criadas?: number
          detalhes?: Json | null
          duracao_ms?: number | null
          erro_mensagem?: string | null
          erros?: number
          finalizado_em?: string | null
          http_status?: number | null
          id?: string
          ignoradas?: number
          iniciado_em?: string
          origem?: string
          sucesso?: boolean
          total?: number
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verificar_status_inscricao: {
        Args: { p_id: string }
        Returns: {
          nome: string
          status: Database["public"]["Enums"]["inscricao_status"]
          valor: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      inscricao_status:
        | "pendente"
        | "pago"
        | "recusado"
        | "reembolsado"
        | "chargeback"
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
      app_role: ["admin", "user"],
      inscricao_status: [
        "pendente",
        "pago",
        "recusado",
        "reembolsado",
        "chargeback",
      ],
    },
  },
} as const
