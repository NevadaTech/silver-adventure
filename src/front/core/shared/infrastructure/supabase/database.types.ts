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
    PostgrestVersion: '14.5'
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
      agent_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          read: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          read?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'agent_events_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      ai_match_cache: {
        Row: {
          cached_at: string
          ciiu_destino: string
          ciiu_origen: string
          confidence: number | null
          has_match: boolean
          model_version: string | null
          reason: string | null
          relation_type: string | null
        }
        Insert: {
          cached_at?: string
          ciiu_destino: string
          ciiu_origen: string
          confidence?: number | null
          has_match: boolean
          model_version?: string | null
          reason?: string | null
          relation_type?: string | null
        }
        Update: {
          cached_at?: string
          ciiu_destino?: string
          ciiu_origen?: string
          confidence?: number | null
          has_match?: boolean
          model_version?: string | null
          reason?: string | null
          relation_type?: string | null
        }
        Relationships: []
      }
      ciiu_taxonomy: {
        Row: {
          code: string
          division: string
          grupo: string
          macro_sector: string | null
          seccion: string
          titulo_actividad: string
          titulo_division: string
          titulo_grupo: string
          titulo_seccion: string
        }
        Insert: {
          code: string
          division: string
          grupo: string
          macro_sector?: string | null
          seccion: string
          titulo_actividad: string
          titulo_division: string
          titulo_grupo: string
          titulo_seccion: string
        }
        Update: {
          code?: string
          division?: string
          grupo?: string
          macro_sector?: string | null
          seccion?: string
          titulo_actividad?: string
          titulo_division?: string
          titulo_grupo?: string
          titulo_seccion?: string
        }
        Relationships: []
      }
      cluster_ciiu_mapping: {
        Row: {
          ciiu_code: string
          cluster_id: string
        }
        Insert: {
          ciiu_code: string
          cluster_id: string
        }
        Update: {
          ciiu_code?: string
          cluster_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cluster_ciiu_mapping_cluster_id_fkey'
            columns: ['cluster_id']
            isOneToOne: false
            referencedRelation: 'clusters'
            referencedColumns: ['id']
          },
        ]
      }
      cluster_members: {
        Row: {
          added_at: string
          cluster_id: string
          company_id: string
        }
        Insert: {
          added_at?: string
          cluster_id: string
          company_id: string
        }
        Update: {
          added_at?: string
          cluster_id?: string
          company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cluster_members_cluster_id_fkey'
            columns: ['cluster_id']
            isOneToOne: false
            referencedRelation: 'clusters'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cluster_members_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      clusters: {
        Row: {
          ciiu_division: string | null
          ciiu_grupo: string | null
          codigo: string
          descripcion: string | null
          generated_at: string
          id: string
          macro_sector: string | null
          member_count: number
          municipio: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ciiu_division?: string | null
          ciiu_grupo?: string | null
          codigo: string
          descripcion?: string | null
          generated_at?: string
          id: string
          macro_sector?: string | null
          member_count?: number
          municipio?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          ciiu_division?: string | null
          ciiu_grupo?: string | null
          codigo?: string
          descripcion?: string | null
          generated_at?: string
          id?: string
          macro_sector?: string | null
          member_count?: number
          municipio?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          activos_totales: number | null
          ciiu: string
          ciiu_division: string
          ciiu_grupo: string
          ciiu_seccion: string
          created_at: string
          direccion: string | null
          email: string | null
          estado: string
          etapa: string
          fecha_matricula: string | null
          fecha_renovacion: string | null
          id: string
          ingreso_operacion: number | null
          municipio: string
          personal: number | null
          razon_social: string
          telefono: string | null
          tipo_organizacion: string | null
          updated_at: string
        }
        Insert: {
          activos_totales?: number | null
          ciiu: string
          ciiu_division: string
          ciiu_grupo: string
          ciiu_seccion: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string
          etapa: string
          fecha_matricula?: string | null
          fecha_renovacion?: string | null
          id: string
          ingreso_operacion?: number | null
          municipio: string
          personal?: number | null
          razon_social: string
          telefono?: string | null
          tipo_organizacion?: string | null
          updated_at?: string
        }
        Update: {
          activos_totales?: number | null
          ciiu?: string
          ciiu_division?: string
          ciiu_grupo?: string
          ciiu_seccion?: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string
          etapa?: string
          fecha_matricula?: string | null
          fecha_renovacion?: string | null
          id?: string
          ingreso_operacion?: number | null
          municipio?: string
          personal?: number | null
          razon_social?: string
          telefono?: string | null
          tipo_organizacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      otp_sessions: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          phone_number: string
          registration_data: Json
          session_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          phone_number: string
          registration_data: Json
          session_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          phone_number?: string
          registration_data?: Json
          session_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          explanation: string | null
          explanation_cached_at: string | null
          id: string
          reasons: Json
          relation_type: string
          score: number
          source: string
          source_company_id: string
          target_company_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          explanation_cached_at?: string | null
          id?: string
          reasons?: Json
          relation_type: string
          score: number
          source: string
          source_company_id: string
          target_company_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          explanation_cached_at?: string | null
          id?: string
          reasons?: Json
          relation_type?: string
          score?: number
          source?: string
          source_company_id?: string
          target_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recommendations_source_company_id_fkey'
            columns: ['source_company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recommendations_target_company_id_fkey'
            columns: ['target_company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      scan_runs: {
        Row: {
          clusters_generated: number
          companies_scanned: number
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          events_emitted: number
          id: string
          recommendations_generated: number
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          clusters_generated?: number
          companies_scanned?: number
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          events_emitted?: number
          id?: string
          recommendations_generated?: number
          started_at?: string
          status: string
          trigger: string
        }
        Update: {
          clusters_generated?: number
          companies_scanned?: number
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          events_emitted?: number
          id?: string
          recommendations_generated?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          barrio: string | null
          company_id: string | null
          created_at: string
          email: string | null
          has_chamber: boolean | null
          id: string
          municipio: string | null
          name: string
          nit: string | null
          sector: string | null
          whatsapp: string | null
          years_of_operation: string | null
        }
        Insert: {
          barrio?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          has_chamber?: boolean | null
          id?: string
          municipio?: string | null
          name: string
          nit?: string | null
          sector?: string | null
          whatsapp?: string | null
          years_of_operation?: string | null
        }
        Update: {
          barrio?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          has_chamber?: boolean | null
          id?: string
          municipio?: string | null
          name?: string
          nit?: string | null
          sector?: string | null
          whatsapp?: string | null
          years_of_operation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'users_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
