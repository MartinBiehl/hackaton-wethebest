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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          email_convite: string | null
          id: string
          limite_mensal_centavos: number | null
          nome: string
          user_id: string | null
          user_id_pendente: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          email_convite?: string | null
          id?: string
          limite_mensal_centavos?: number | null
          nome: string
          user_id?: string | null
          user_id_pendente?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          email_convite?: string | null
          id?: string
          limite_mensal_centavos?: number | null
          nome?: string
          user_id?: string | null
          user_id_pendente?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          id: number
          vinculo_automatico: boolean
        }
        Insert: {
          atualizado_em?: string
          id?: number
          vinculo_automatico?: boolean
        }
        Update: {
          atualizado_em?: string
          id?: number
          vinculo_automatico?: boolean
        }
        Relationships: []
      }
      estoque: {
        Row: {
          atualizado_em: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          atualizado_em?: string
          produto_id: string
          quantidade?: number
        }
        Update: {
          atualizado_em?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_financeiros: {
        Row: {
          aluno_id: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          valor_centavos: number
          venda_id: string | null
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          valor_centavos: number
          venda_id?: string | null
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
          valor_centavos?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "saldos_alunos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email: string
          id: string
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          preco_centavos: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          preco_centavos: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          preco_centavos?: number
        }
        Relationships: []
      }
      responsavel_aluno: {
        Row: {
          aluno_id: string
          atualizado_em: string
          criado_em: string
          responsavel_id: string
          status: Database["public"]["Enums"]["status_vinculo"]
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          criado_em?: string
          responsavel_id: string
          status?: Database["public"]["Enums"]["status_vinculo"]
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          criado_em?: string
          responsavel_id?: string
          status?: Database["public"]["Enums"]["status_vinculo"]
        }
        Relationships: [
          {
            foreignKeyName: "responsavel_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsavel_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "saldos_alunos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      venda_itens: {
        Row: {
          id: string
          nome_produto: string
          preco_unitario_centavos: number
          produto_id: string | null
          quantidade: number
          subtotal_centavos: number
          venda_id: string
        }
        Insert: {
          id?: string
          nome_produto: string
          preco_unitario_centavos: number
          produto_id?: string | null
          quantidade: number
          subtotal_centavos: number
          venda_id: string
        }
        Update: {
          id?: string
          nome_produto?: string
          preco_unitario_centavos?: number
          produto_id?: string | null
          quantidade?: number
          subtotal_centavos?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          aluno_id: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          criado_em: string
          id: string
          motivo_cancelamento: string | null
          observacao: string | null
          operador_id: string | null
          status: Database["public"]["Enums"]["status_venda"]
          total_centavos: number
        }
        Insert: {
          aluno_id?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          id?: string
          motivo_cancelamento?: string | null
          observacao?: string | null
          operador_id?: string | null
          status?: Database["public"]["Enums"]["status_venda"]
          total_centavos: number
        }
        Update: {
          aluno_id?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          id?: string
          motivo_cancelamento?: string | null
          observacao?: string | null
          operador_id?: string | null
          status?: Database["public"]["Enums"]["status_venda"]
          total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "saldos_alunos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
    }
    Views: {
      gastos_mensais_alunos: {
        Row: {
          aluno_id: string | null
          competencia: string | null
          quantidade_vendas: number | null
          total_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "saldos_alunos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      saldos_alunos: {
        Row: {
          aluno_id: string | null
          saldo_centavos: number | null
          total_creditos_centavos: number | null
          total_debitos_centavos: number | null
          ultimo_movimento_em: string | null
        }
        Relationships: []
      }
      vendas_mensais: {
        Row: {
          competencia: string | null
          quantidade_vendas: number | null
          total_centavos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adicionar_credito: {
        Args: {
          p_aluno_id: string
          p_descricao?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
      aprovar_conta_aluno: { Args: { p_aluno_id: string }; Returns: Json }
      aprovar_vinculo_responsavel: {
        Args: { p_aluno_id: string; p_responsavel_id: string }
        Returns: Json
      }
      cadastrar_aluno: {
        Args: { p_email?: string; p_nome: string }
        Returns: Json
      }
      cancelar_venda: {
        Args: { p_motivo?: string; p_venda_id: string }
        Returns: Json
      }
      definir_limite_mensal: {
        Args: { p_aluno_id: string; p_limite_centavos: number }
        Returns: Json
      }
      e_equipe: { Args: never; Returns: boolean }
      e_responsavel_de: { Args: { p_aluno_id: string }; Returns: boolean }
      e_titular_do_aluno: { Args: { p_aluno_id: string }; Returns: boolean }
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      piso_saldo_centavos: { Args: never; Returns: number }
      prazo_cancelamento: { Args: never; Returns: string }
      registrar_pagamento: {
        Args: {
          p_aluno_id: string
          p_descricao?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
      registrar_venda: {
        Args: { p_aluno_id?: string; p_itens?: Json; p_observacao?: string }
        Returns: Json
      }
      revogar_vinculo_responsavel: {
        Args: { p_aluno_id: string; p_responsavel_id: string }
        Returns: Json
      }
      vincular_conta_aluno: {
        Args: { p_email_responsavel: string }
        Returns: Json
      }
    }
    Enums: {
      papel_usuario: "equipe" | "responsavel" | "aluno"
      status_venda: "confirmada" | "cancelada"
      status_vinculo: "pendente" | "ativo" | "revogado"
      tipo_movimento: "credito" | "compra" | "pagamento" | "ajuste" | "estorno"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      papel_usuario: ["equipe", "responsavel", "aluno"],
      status_venda: ["confirmada", "cancelada"],
      status_vinculo: ["pendente", "ativo", "revogado"],
      tipo_movimento: ["credito", "compra", "pagamento", "ajuste", "estorno"],
    },
  },
} as const
