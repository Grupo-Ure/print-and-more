export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      blueprint_customers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          short_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          short_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          short_code?: string | null
        }
        Relationships: []
      }
      blueprint_job_items: {
        Row: {
          copies: number
          created_at: string
          filename: string | null
          format: string
          height_mm: number | null
          id: string
          is_color: boolean
          job_id: string
          page_count: number
          width_mm: number | null
        }
        Insert: {
          copies?: number
          created_at?: string
          filename?: string | null
          format: string
          height_mm?: number | null
          id?: string
          is_color: boolean
          job_id: string
          page_count?: number
          width_mm?: number | null
        }
        Update: {
          copies?: number
          created_at?: string
          filename?: string | null
          format?: string
          height_mm?: number | null
          id?: string
          is_color?: boolean
          job_id?: string
          page_count?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "blueprint_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_jobs: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          job_date: string
          notes: string | null
          project_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          job_date?: string
          notes?: string | null
          project_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          job_date?: string
          notes?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "blueprint_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "blueprint_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_projects: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "blueprint_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          house_number: string | null
          id: string
          is_archived: boolean
          name: string
          note: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          house_number?: string | null
          id?: string
          is_archived?: boolean
          name: string
          note?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          house_number?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Relationships: []
      }
      erp_exports: {
        Row: {
          export_data: Json
          exported_at: string
          exported_by: string | null
          id: string
          mode: string
          order_id: string
        }
        Insert: {
          export_data: Json
          exported_at?: string
          exported_by?: string | null
          id?: string
          mode: string
          order_id: string
        }
        Update: {
          export_data?: Json
          exported_at?: string
          exported_by?: string | null
          id?: string
          mode?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_exports_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_exports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      errors: {
        Row: {
          created_at: string
          id: string
          order_id: string
          sub_order_id: string | null
          text: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          sub_order_id?: string | null
          text: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          sub_order_id?: string | null
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "errors_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "errors_person_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "errors_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          order_id: string
          path: string
          replaces_file_id: string | null
          role: Database["public"]["Enums"]["file_role"]
          thumbnail_path: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          order_id: string
          path: string
          replaces_file_id?: string | null
          role?: Database["public"]["Enums"]["file_role"]
          thumbnail_path?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          order_id?: string
          path?: string
          replaces_file_id?: string | null
          role?: Database["public"]["Enums"]["file_role"]
          thumbnail_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_replaces_file_id_fkey"
            columns: ["replaces_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      history: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["history_event"]
          id: string
          meta: Json | null
          order_id: string
          reason: string | null
          sub_order_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["history_event"]
          id?: string
          meta?: Json | null
          order_id: string
          reason?: string | null
          sub_order_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["history_event"]
          id?: string
          meta?: Json | null
          order_id?: string
          reason?: string | null
          sub_order_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_person_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_counter: {
        Row: {
          last_value: number
          month: number
          year: number
        }
        Insert: {
          last_value?: number
          month: number
          year: number
        }
        Update: {
          last_value?: number
          month?: number
          year?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          billing_note: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deadline: string | null
          delivery: Database["public"]["Enums"]["delivery_type"] | null
          id: string
          is_archived: boolean
          is_emergency: boolean
          is_erp_exported: boolean
          order_number: string
          priority: Database["public"]["Enums"]["priority_type"]
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          billing_note?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          id?: string
          is_archived?: boolean
          is_emergency?: boolean
          is_erp_exported?: boolean
          order_number: string
          priority?: Database["public"]["Enums"]["priority_type"]
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          billing_note?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          id?: string
          is_archived?: boolean
          is_emergency?: boolean
          is_erp_exported?: boolean
          order_number?: string
          priority?: Database["public"]["Enums"]["priority_type"]
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          created_at: string
          file_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sub_order_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_models: {
        Row: {
          article_number: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          max_height_mm: number | null
          max_width_mm: number | null
          min_stock: number
          name: string
          net_price: number | null
          note: string | null
          print_area: string | null
          replacement_pad_article_number: string | null
          size: string | null
          stock: number
          type: string
        }
        Insert: {
          article_number?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_height_mm?: number | null
          max_width_mm?: number | null
          min_stock?: number
          name: string
          net_price?: number | null
          note?: string | null
          print_area?: string | null
          replacement_pad_article_number?: string | null
          size?: string | null
          stock?: number
          type: string
        }
        Update: {
          article_number?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_height_mm?: number | null
          max_width_mm?: number | null
          min_stock?: number
          name?: string
          net_price?: number | null
          note?: string | null
          print_area?: string | null
          replacement_pad_article_number?: string | null
          size?: string | null
          stock?: number
          type?: string
        }
        Relationships: []
      }
      stamp_stock_movements: {
        Row: {
          created_at: string
          id: string
          model_id: string
          note: string | null
          quantity: number
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          note?: string | null
          quantity: number
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          note?: string | null
          quantity?: number
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stamp_stock_movements_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_stock_movements_person_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_order_products: {
        Row: {
          created_at: string
          department: string
          detail: Json
          id: string
          sort_order: number
          sub_order_id: string
        }
        Insert: {
          created_at?: string
          department: string
          detail?: Json
          id?: string
          sort_order?: number
          sub_order_id: string
        }
        Update: {
          created_at?: string
          department?: string
          detail?: Json
          id?: string
          sort_order?: number
          sub_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_order_products_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_orders: {
        Row: {
          assignee_id: string | null
          created_at: string
          customer_approval_file_id: string | null
          customer_approval_granted: boolean
          customer_approval_required: boolean
          data_status: string | null
          deadline: string | null
          delivery: Database["public"]["Enums"]["delivery_type"] | null
          department: Database["public"]["Enums"]["sub_order_department"]
          detail: Json
          emergency_reason: string | null
          id: string
          is_cancelled: boolean
          is_emergency: boolean
          order_id: string
          priority: Database["public"]["Enums"]["priority_type"]
          sort_order: number
          status: Database["public"]["Enums"]["order_status"]
          type: string | null
          typesetting_minutes: number | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          customer_approval_file_id?: string | null
          customer_approval_granted?: boolean
          customer_approval_required?: boolean
          data_status?: string | null
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          department: Database["public"]["Enums"]["sub_order_department"]
          detail?: Json
          emergency_reason?: string | null
          id?: string
          is_cancelled?: boolean
          is_emergency?: boolean
          order_id: string
          priority?: Database["public"]["Enums"]["priority_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["order_status"]
          type?: string | null
          typesetting_minutes?: number | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          customer_approval_file_id?: string | null
          customer_approval_granted?: boolean
          customer_approval_required?: boolean
          data_status?: string | null
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          department?: Database["public"]["Enums"]["sub_order_department"]
          detail?: Json
          emergency_reason?: string | null
          id?: string
          is_cancelled?: boolean
          is_emergency?: boolean
          order_id?: string
          priority?: Database["public"]["Enums"]["priority_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["order_status"]
          type?: string | null
          typesetting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_approval_file"
            columns: ["customer_approval_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_assignments: {
        Row: {
          created_at: string
          id: string
          motif_id: string
          position_id: string
          sub_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motif_id: string
          position_id: string
          sub_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motif_id?: string
          position_id?: string
          sub_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textile_assignments_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "textile_motifs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "textile_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_assignments_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      textile_motifs: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          file_id: string | null
          font_class: Database["public"]["Enums"]["textile_font_class"] | null
          font_name: string | null
          id: string
          placement: string
          print_method: string | null
          size: string
          sub_order_id: string
          type: Database["public"]["Enums"]["textile_motif_type"]
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          file_id?: string | null
          font_class?: Database["public"]["Enums"]["textile_font_class"] | null
          font_name?: string | null
          id?: string
          placement?: string
          print_method?: string | null
          size?: string
          sub_order_id: string
          type: Database["public"]["Enums"]["textile_motif_type"]
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          file_id?: string | null
          font_class?: Database["public"]["Enums"]["textile_font_class"] | null
          font_name?: string | null
          id?: string
          placement?: string
          print_method?: string | null
          size?: string
          sub_order_id?: string
          type?: Database["public"]["Enums"]["textile_motif_type"]
        }
        Relationships: [
          {
            foreignKeyName: "textile_motifs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_motifs_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_positions: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          id: string
          model: string | null
          origin: Database["public"]["Enums"]["textile_origin"]
          quantity: number
          size: string | null
          sub_order_id: string
          type: string | null
          variant_id: string | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          model?: string | null
          origin: Database["public"]["Enums"]["textile_origin"]
          quantity: number
          size?: string | null
          sub_order_id: string
          type?: string | null
          variant_id?: string | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          model?: string | null
          origin?: Database["public"]["Enums"]["textile_origin"]
          quantity?: number
          size?: string | null
          sub_order_id?: string
          type?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textile_positions_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_positions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "textile_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_products: {
        Row: {
          article_number: string | null
          brand_id: string
          created_at: string
          description: string | null
          finishing_options: string[] | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          article_number?: string | null
          brand_id: string
          created_at?: string
          description?: string | null
          finishing_options?: string[] | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          article_number?: string | null
          brand_id?: string
          created_at?: string
          description?: string | null
          finishing_options?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "textile_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "textile_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_stock_movements: {
        Row: {
          created_at: string
          id: string
          note: string | null
          quantity: number
          type: string
          user_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          quantity: number
          type: string
          user_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          quantity?: number
          type?: string
          user_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textile_stock_movements_person_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "textile_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_variants: {
        Row: {
          color: string
          color_hex: string | null
          created_at: string
          id: string
          is_active: boolean
          is_sample: boolean
          material: string | null
          min_stock: number
          product_id: string
          size: string
          sort_order: number
          stock: number
        }
        Insert: {
          color: string
          color_hex?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_sample?: boolean
          material?: string | null
          min_stock?: number
          product_id: string
          size: string
          sort_order?: number
          stock?: number
        }
        Update: {
          color?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_sample?: boolean
          material?: string | null
          min_stock?: number
          product_id?: string
          size?: string
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "textile_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "textile_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees: {
        Row: {
          email: string | null
          id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      duplicate_order: {
        Args: {
          created_by_user_id: string
          new_deadline: string
          new_delivery: string
          new_priority: string
          selected_sub_order_ids: string[]
          source_order_id: string
        }
        Returns: string
      }
    }
    Enums: {
      delivery_type: "PICKUP" | "SHIPPING"
      file_role:
        | "PRODUCTION_FILE"
        | "PREVIEW"
        | "CUSTOMER_APPROVAL"
        | "REFERENCE"
      history_event:
        | "ORDER_CREATED"
        | "PROCESSING_STARTED"
        | "PREPRESS_READY_AUTO"
        | "PREPRESS_READY_MANUAL"
        | "PRODUCTION_READY_SET"
        | "MARKED_DONE"
        | "EMERGENCY_TRIGGERED"
        | "CUSTOMER_APPROVAL_ACTIVATED"
        | "CUSTOMER_APPROVAL_GRANTED"
        | "CUSTOMER_APPROVAL_EXPIRED"
        | "CUSTOMER_APPROVAL_BYPASSED"
        | "ROLLED_BACK"
        | "CANCELLED"
        | "ERP_EXPORTED"
      order_status:
        | "QUOTE"
        | "INCOMPLETE"
        | "PREPRESS_READY"
        | "PRODUCTION_READY"
        | "DONE"
        | "INVOICED"
      priority_type: "NORMAL" | "HIGH"
      sub_order_department:
        | "LFP"
        | "COPYSHOP"
        | "TEXTILE"
        | "STAMP"
        | "LASER_ENGRAVING"
        | "OTHER"
      textile_font_class: "SANS_SERIF" | "SERIF" | "ELEGANT" | "PLAYFUL"
      textile_motif_type: "TEXT" | "FILE"
      textile_origin: "CUSTOMER_STOCK" | "OWN_STOCK"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivery_type: ["PICKUP", "SHIPPING"],
      file_role: [
        "PRODUCTION_FILE",
        "PREVIEW",
        "CUSTOMER_APPROVAL",
        "REFERENCE",
      ],
      history_event: [
        "ORDER_CREATED",
        "PROCESSING_STARTED",
        "PREPRESS_READY_AUTO",
        "PREPRESS_READY_MANUAL",
        "PRODUCTION_READY_SET",
        "MARKED_DONE",
        "EMERGENCY_TRIGGERED",
        "CUSTOMER_APPROVAL_ACTIVATED",
        "CUSTOMER_APPROVAL_GRANTED",
        "CUSTOMER_APPROVAL_EXPIRED",
        "CUSTOMER_APPROVAL_BYPASSED",
        "ROLLED_BACK",
        "CANCELLED",
        "ERP_EXPORTED",
      ],
      order_status: [
        "QUOTE",
        "INCOMPLETE",
        "PREPRESS_READY",
        "PRODUCTION_READY",
        "DONE",
        "INVOICED",
      ],
      priority_type: ["NORMAL", "HIGH"],
      sub_order_department: [
        "LFP",
        "COPYSHOP",
        "TEXTILE",
        "STAMP",
        "LASER_ENGRAVING",
        "OTHER",
      ],
      textile_font_class: ["SANS_SERIF", "SERIF", "ELEGANT", "PLAYFUL"],
      textile_motif_type: ["TEXT", "FILE"],
      textile_origin: ["CUSTOMER_STOCK", "OWN_STOCK"],
    },
  },
} as const

