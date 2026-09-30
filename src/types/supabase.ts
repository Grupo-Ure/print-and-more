export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
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
      banner_products: {
        Row: {
          eyelet_detail: string | null
          eyelets: boolean | null
          height: number | null
          hem: boolean | null
          hem_sides: string | null
          material: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          eyelet_detail?: string | null
          eyelets?: boolean | null
          height?: number | null
          hem?: boolean | null
          hem_sides?: string | null
          material?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          eyelet_detail?: string | null
          eyelets?: boolean | null
          height?: number | null
          hem?: boolean | null
          hem_sides?: string | null
          material?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "banner_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      binding_products: {
        Row: {
          binding_color: string | null
          binding_type: string | null
          color_mode: string | null
          format: string | null
          full_bleed: boolean | null
          hardcover_cover: string | null
          hardcover_print: boolean | null
          height: number | null
          material: string | null
          material_other: string | null
          orientation: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          binding_color?: string | null
          binding_type?: string | null
          color_mode?: string | null
          format?: string | null
          full_bleed?: boolean | null
          hardcover_cover?: string | null
          hardcover_print?: boolean | null
          height?: number | null
          material?: string | null
          material_other?: string | null
          orientation?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          binding_color?: string | null
          binding_type?: string | null
          color_mode?: string | null
          format?: string | null
          full_bleed?: boolean | null
          hardcover_cover?: string | null
          hardcover_print?: boolean | null
          height?: number | null
          material?: string | null
          material_other?: string | null
          orientation?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "binding_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
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
      brochure_products: {
        Row: {
          binding: string | null
          cover_finish: string | null
          cover_material: string | null
          cover_material_other: string | null
          cover_weight: string | null
          format: string | null
          full_bleed: boolean | null
          height: number | null
          inner_finish: string | null
          inner_material: string | null
          inner_material_other: string | null
          inner_weight: string | null
          orientation: string | null
          page_count: number | null
          product_id: string
          production_path: string | null
          width: number | null
        }
        Insert: {
          binding?: string | null
          cover_finish?: string | null
          cover_material?: string | null
          cover_material_other?: string | null
          cover_weight?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          inner_finish?: string | null
          inner_material?: string | null
          inner_material_other?: string | null
          inner_weight?: string | null
          orientation?: string | null
          page_count?: number | null
          product_id: string
          production_path?: string | null
          width?: number | null
        }
        Update: {
          binding?: string | null
          cover_finish?: string | null
          cover_material?: string | null
          cover_material_other?: string | null
          cover_weight?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          inner_finish?: string | null
          inner_material?: string | null
          inner_material_other?: string | null
          inner_weight?: string | null
          orientation?: string | null
          page_count?: number | null
          product_id?: string
          production_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brochure_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      business_card_products: {
        Row: {
          color_mode: string | null
          film_laminated: boolean | null
          format: string | null
          full_bleed: boolean | null
          height: number | null
          material: string | null
          multiloft_color: string | null
          orientation: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          color_mode?: string | null
          film_laminated?: boolean | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          material?: string | null
          multiloft_color?: string | null
          orientation?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          color_mode?: string | null
          film_laminated?: boolean | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          material?: string | null
          multiloft_color?: string | null
          orientation?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_card_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      card_flyer_products: {
        Row: {
          cc_material: string | null
          cc_material_other: string | null
          color_mode: string | null
          format: string | null
          full_bleed: boolean | null
          height: number | null
          lamination_finish: string | null
          lamination_sides: string | null
          offset_finish: string | null
          offset_type: string | null
          offset_weight: string | null
          product_id: string
          production_path: string | null
          recycling_weight: string | null
          special_paper: string | null
          special_paper_other: string | null
          width: number | null
        }
        Insert: {
          cc_material?: string | null
          cc_material_other?: string | null
          color_mode?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
          product_id: string
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Update: {
          cc_material?: string | null
          cc_material_other?: string | null
          color_mode?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
          product_id?: string
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_flyer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
      date_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          description: string | null
          height: number | null
          product_id: string
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id: string
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "date_stamp_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "date_stamp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      department_default_assignees: {
        Row: {
          department: Database["public"]["Enums"]["department"]
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          department: Database["public"]["Enums"]["department"]
          status: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          department?: Database["public"]["Enums"]["department"]
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_default_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_exports: {
        Row: {
          export_data: NonNullable<Json>
          exported_at: string
          exported_by: string | null
          id: string
          mode: string
          order_id: string
        }
        Insert: {
          export_data: NonNullable<Json>
          exported_at?: string
          exported_by?: string | null
          id?: string
          mode: string
          order_id: string
        }
        Update: {
          export_data?: NonNullable<Json>
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
            referencedRelation: "users"
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
            referencedRelation: "users"
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
      foil_plotter_products: {
        Row: {
          height: number | null
          material: string | null
          output: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          height?: number | null
          material?: string | null
          output?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          height?: number | null
          material?: string | null
          output?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "foil_plotter_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      folded_flyer_products: {
        Row: {
          cc_material: string | null
          cc_material_other: string | null
          color_mode: string | null
          fold_type: string | null
          format: string | null
          full_bleed: boolean | null
          height: number | null
          lamination_finish: string | null
          lamination_sides: string | null
          offset_finish: string | null
          offset_type: string | null
          offset_weight: string | null
          page_count: number | null
          product_id: string
          production_path: string | null
          recycling_weight: string | null
          special_paper: string | null
          special_paper_other: string | null
          width: number | null
        }
        Insert: {
          cc_material?: string | null
          cc_material_other?: string | null
          color_mode?: string | null
          fold_type?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
          page_count?: number | null
          product_id: string
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Update: {
          cc_material?: string | null
          cc_material_other?: string | null
          color_mode?: string | null
          fold_type?: string | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
          page_count?: number | null
          product_id?: string
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folded_flyer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_item_products: {
        Row: {
          material_free_text: string | null
          motif: string | null
          origin: string | null
          product_id: string
        }
        Insert: {
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          product_id: string
        }
        Update: {
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_item_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
          product_id: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["history_event"]
          id?: string
          meta?: Json | null
          order_id: string
          product_id?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["history_event"]
          id?: string
          meta?: Json | null
          order_id?: string
          product_id?: string | null
          reason?: string | null
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ink_pad_products: {
        Row: {
          color: string | null
          pad_size: string | null
          product_id: string
        }
        Insert: {
          color?: string | null
          pad_size?: string | null
          product_id: string
        }
        Update: {
          color?: string | null
          pad_size?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ink_pad_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "ink_pad_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      name_tag_products: {
        Row: {
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          product_id: string
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id: string
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id?: string
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "name_tag_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
          is_erp_exported: boolean
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
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
          is_erp_exported?: boolean
          order_number: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
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
          is_erp_exported?: boolean
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          priority?: Database["public"]["Enums"]["priority_type"]
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
      other_laser_products: {
        Row: {
          material_free_text: string | null
          motif: string | null
          origin: string | null
          product_id: string
          self_adhesive: boolean | null
        }
        Insert: {
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          product_id: string
          self_adhesive?: boolean | null
        }
        Update: {
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          product_id?: string
          self_adhesive?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "other_laser_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_lfp_products: {
        Row: {
          description: string | null
          product_id: string
        }
        Insert: {
          description?: string | null
          product_id: string
        }
        Update: {
          description?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_lfp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_products: {
        Row: {
          description: string | null
          product_id: string
        }
        Insert: {
          description?: string | null
          product_id: string
        }
        Update: {
          description?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          description: string | null
          height: number | null
          product_id: string
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id: string
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "other_stamp_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "other_stamp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_products: {
        Row: {
          format: string | null
          height: number | null
          laminate: string | null
          material: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          format?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          format?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      printout_products: {
        Row: {
          color_mode: string | null
          format: string | null
          laminate: string | null
          material: string | null
          material_other: string | null
          product_id: string
          punching: string | null
          staple: boolean | null
        }
        Insert: {
          color_mode?: string | null
          format?: string | null
          laminate?: string | null
          material?: string | null
          material_other?: string | null
          product_id: string
          punching?: string | null
          staple?: boolean | null
        }
        Update: {
          color_mode?: string | null
          format?: string | null
          laminate?: string | null
          material?: string | null
          material_other?: string | null
          product_id?: string
          punching?: string | null
          staple?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "printout_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_number_counter: {
        Row: {
          department: Database["public"]["Enums"]["department"]
          last_value: number
          order_id: string
        }
        Insert: {
          department: Database["public"]["Enums"]["department"]
          last_value: number
          order_id: string
        }
        Update: {
          department?: Database["public"]["Enums"]["department"]
          last_value?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_number_counter_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_time_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          minutes: number
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          minutes: number
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          minutes?: number
          product_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_time_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_time_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          assignee_id: string | null
          created_at: string
          customer_approval_file_id: string | null
          customer_approval_granted: boolean
          customer_approval_required: boolean
          deadline: string | null
          delivery: Database["public"]["Enums"]["delivery_type"] | null
          department: Database["public"]["Enums"]["department"]
          id: string
          is_cancelled: boolean
          notes: string | null
          order_id: string
          priority: Database["public"]["Enums"]["priority_type"] | null
          product_number: string
          quantity: number | null
          sort_order: number
          status: Database["public"]["Enums"]["product_status"]
          type: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          customer_approval_file_id?: string | null
          customer_approval_granted?: boolean
          customer_approval_required?: boolean
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          department: Database["public"]["Enums"]["department"]
          id?: string
          is_cancelled?: boolean
          notes?: string | null
          order_id: string
          priority?: Database["public"]["Enums"]["priority_type"] | null
          product_number: string
          quantity?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          type: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          customer_approval_file_id?: string | null
          customer_approval_granted?: boolean
          customer_approval_required?: boolean
          deadline?: string | null
          delivery?: Database["public"]["Enums"]["delivery_type"] | null
          department?: Database["public"]["Enums"]["department"]
          id?: string
          is_cancelled?: boolean
          notes?: string | null
          order_id?: string
          priority?: Database["public"]["Enums"]["priority_type"] | null
          product_number?: string
          quantity?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          type?: string
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
            foreignKeyName: "products_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      refill_ink_products: {
        Row: {
          color: string | null
          ink_type: string | null
          product_id: string
        }
        Insert: {
          color?: string | null
          ink_type?: string | null
          product_id: string
        }
        Update: {
          color?: string | null
          ink_type?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refill_ink_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "refill_ink_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rollup_products: {
        Row: {
          material: string | null
          product_id: string
          rollup_system: string | null
          rollup_width: number | null
        }
        Insert: {
          material?: string | null
          product_id: string
          rollup_system?: string | null
          rollup_width?: number | null
        }
        Update: {
          material?: string | null
          product_id?: string
          rollup_system?: string | null
          rollup_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rollup_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_foil_products: {
        Row: {
          drill_hole_diameter: number | null
          drill_hole_position: string | null
          drill_holes: boolean | null
          height: number | null
          laminate: string | null
          material: string | null
          print_side: string | null
          product_id: string
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          print_side?: string | null
          product_id: string
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          print_side?: string | null
          product_id?: string
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_foil_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_products: {
        Row: {
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          product_id: string
          round_corners: boolean | null
          self_adhesive: boolean | null
          width: number | null
        }
        Insert: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id: string
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Update: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id?: string
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_uv_products: {
        Row: {
          acrylic_print_direction: string | null
          drill_hole_diameter: number | null
          drill_hole_position: string | null
          drill_holes: boolean | null
          height: number | null
          material: string | null
          print_side: string | null
          product_id: string
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          acrylic_print_direction?: string | null
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          material?: string | null
          print_side?: string | null
          product_id: string
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          acrylic_print_direction?: string | null
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          material?: string | null
          print_side?: string | null
          product_id?: string
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_uv_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_ink_colors: {
        Row: {
          code: string
          hex: string | null
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          hex?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          hex?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "stamp_models_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
        ]
      }
      stamp_plate_products: {
        Row: {
          height: number | null
          product_id: string
          width: number | null
        }
        Insert: {
          height?: number | null
          product_id: string
          width?: number | null
        }
        Update: {
          height?: number | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stamp_plate_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stand_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          description: string | null
          height: number | null
          product_id: string
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id: string
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          height?: number | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stand_stamp_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stand_stamp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_products: {
        Row: {
          contour_cut: string | null
          height: number | null
          laminate: string | null
          material: string | null
          material_variant: string | null
          output: string | null
          product_id: string
          width: number | null
        }
        Insert: {
          contour_cut?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          material_variant?: string | null
          output?: string | null
          product_id: string
          width?: number | null
        }
        Update: {
          contour_cut?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          material_variant?: string | null
          output?: string | null
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sticker_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
      textile_designs: {
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
          product_id: string
          size: string
          type: Database["public"]["Enums"]["textile_design_type"]
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          file_id?: string | null
          font_class?: Database["public"]["Enums"]["textile_font_class"] | null
          font_name?: string | null
          id?: string
          placement: string
          print_method?: string | null
          product_id: string
          size: string
          type: Database["public"]["Enums"]["textile_design_type"]
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
          product_id?: string
          size?: string
          type?: Database["public"]["Enums"]["textile_design_type"]
        }
        Relationships: [
          {
            foreignKeyName: "textile_designs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_designs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_garments: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          garment_type: string | null
          id: string
          model: string | null
          origin: string | null
          product_id: string
          quantity: number
          size: string | null
          sort_order: number
          variant_id: string | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          garment_type?: string | null
          id?: string
          model?: string | null
          origin?: string | null
          product_id: string
          quantity: number
          size?: string | null
          sort_order?: number
          variant_id?: string | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          garment_type?: string | null
          id?: string
          model?: string | null
          origin?: string | null
          product_id?: string
          quantity?: number
          size?: string | null
          sort_order?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textile_garments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_garments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "textile_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_models: {
        Row: {
          article_number: string | null
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          article_number?: string | null
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          article_number?: string | null
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "textile_models_brand_id_fkey"
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
            referencedRelation: "users"
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
          material: string | null
          min_stock: number
          model_id: string
          sample_stock: number
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
          material?: string | null
          min_stock?: number
          model_id: string
          sample_stock?: number
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
          material?: string | null
          min_stock?: number
          model_id?: string
          sample_stock?: number
          size?: string
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "textile_variants_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "textile_models"
            referencedColumns: ["id"]
          },
        ]
      }
      trodat_pad_products: {
        Row: {
          color: string | null
          pad_article_number: string | null
          pad_variant_id: string | null
          product_id: string
        }
        Insert: {
          color?: string | null
          pad_article_number?: string | null
          pad_variant_id?: string | null
          product_id: string
        }
        Update: {
          color?: string | null
          pad_article_number?: string | null
          pad_variant_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trodat_pad_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trodat_pad_products_pad_variant_id_fkey"
            columns: ["pad_variant_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trodat_pad_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      trodat_printy_products: {
        Row: {
          color: string | null
          color_other: string | null
          description: string | null
          model_id: string | null
          product_id: string
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          model_id?: string | null
          product_id: string
        }
        Update: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          model_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trodat_printy_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trodat_printy_products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trodat_printy_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      trophy_plate_products: {
        Row: {
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          product_id: string
          round_corners: boolean | null
          self_adhesive: boolean | null
          width: number | null
        }
        Insert: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id: string
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Update: {
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          product_id?: string
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trophy_plate_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_developer: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          is_developer?: boolean
          name: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_developer?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      vehicle_lettering_products: {
        Row: {
          area_front: boolean | null
          area_rear: boolean | null
          area_sides: boolean | null
          existing_wrap: boolean | null
          installation: string | null
          installation_date: string | null
          product_id: string
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          area_front?: boolean | null
          area_rear?: boolean | null
          area_sides?: boolean | null
          existing_wrap?: boolean | null
          installation?: string | null
          installation_date?: string | null
          product_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          area_front?: boolean | null
          area_rear?: boolean | null
          area_sides?: boolean | null
          existing_wrap?: boolean | null
          installation?: string | null
          installation_date?: string | null
          product_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_lettering_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wooden_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          description: string | null
          model_id: string | null
          product_id: string
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          model_id?: string | null
          product_id: string
        }
        Update: {
          color?: string | null
          color_other?: string | null
          description?: string | null
          model_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wooden_stamp_products_color_fkey"
            columns: ["color"]
            isOneToOne: false
            referencedRelation: "stamp_ink_colors"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wooden_stamp_products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wooden_stamp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_production_deductions: {
        Args: { allow_shortage?: boolean; deductions: Json; note: string }
        Returns: Json
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      duplicate_order: {
        Args: {
          created_by_user_id: string
          new_deadline: string
          new_delivery: Database["public"]["Enums"]["delivery_type"]
          new_priority: Database["public"]["Enums"]["priority_type"]
          selected_product_ids: string[]
          source_order_id: string
        }
        Returns: string
      }
      fn_department_abbreviation: {
        Args: { dept: Database["public"]["Enums"]["department"] }
        Returns: string
      }
    }
    Enums: {
      delivery_type: "PICKUP" | "SHIPPING"
      department: "LFP" | "COPYSHOP" | "TEXTILE" | "STAMP" | "LASER_ENGRAVING" | "OTHER"
      file_role: "PRODUCTION_FILE" | "PREVIEW" | "CUSTOMER_APPROVAL" | "REFERENCE"
      history_event:
        | "ORDER_CREATED"
        | "PROCESSING_STARTED"
        | "PREPRESS_READY_AUTO"
        | "PREPRESS_READY_MANUAL"
        | "PRODUCTION_READY_SET"
        | "MARKED_DONE"
        | "EMERGENCY_TRIGGERED"
        | "CUSTOMER_APPROVAL_ACTIVATED"
        | "CUSTOMER_APPROVAL_DEACTIVATED"
        | "CUSTOMER_APPROVAL_GRANTED"
        | "CUSTOMER_APPROVAL_EXPIRED"
        | "CUSTOMER_APPROVAL_BYPASSED"
        | "ROLLED_BACK"
        | "CANCELLED"
        | "ERP_EXPORTED"
        | "ASSIGNEE_CHANGED"
        | "ORDER_FINISHED"
        | "ORDER_REOPENED"
        | "ORDER_BILLED"
        | "ORDER_CLOSED_CASH"
        | "ORDER_ARCHIVED"
        | "TIME_LOGGED"
        | "TIME_LOG_DELETED"
        | "SETTINGS_CHANGED"
        | "PRODUCT_CREATED"
        | "PRODUCT_UPDATED"
        | "PRODUCT_CANCELLED"
        | "PRODUCT_DELETED"
        | "FILE_ADDED"
        | "FILE_REMOVED"
      order_status: "QUOTE" | "IN_PROGRESS" | "FINISHED" | "BILLED"
      payment_method: "INVOICE" | "CASH"
      priority_type: "NORMAL" | "HIGH"
      product_status: "IN_SETUP" | "PREPRESS" | "IN_PRODUCTION" | "DONE"
      textile_design_type: "TEXT" | "FILE"
      textile_font_class: "SANS_SERIF" | "SERIF" | "ELEGANT" | "PLAYFUL"
      user_role: "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
      department: ["LFP", "COPYSHOP", "TEXTILE", "STAMP", "LASER_ENGRAVING", "OTHER"],
      file_role: ["PRODUCTION_FILE", "PREVIEW", "CUSTOMER_APPROVAL", "REFERENCE"],
      history_event: [
        "ORDER_CREATED",
        "PROCESSING_STARTED",
        "PREPRESS_READY_AUTO",
        "PREPRESS_READY_MANUAL",
        "PRODUCTION_READY_SET",
        "MARKED_DONE",
        "EMERGENCY_TRIGGERED",
        "CUSTOMER_APPROVAL_ACTIVATED",
        "CUSTOMER_APPROVAL_DEACTIVATED",
        "CUSTOMER_APPROVAL_GRANTED",
        "CUSTOMER_APPROVAL_EXPIRED",
        "CUSTOMER_APPROVAL_BYPASSED",
        "ROLLED_BACK",
        "CANCELLED",
        "ERP_EXPORTED",
        "ASSIGNEE_CHANGED",
        "ORDER_FINISHED",
        "ORDER_REOPENED",
        "ORDER_BILLED",
        "ORDER_CLOSED_CASH",
        "ORDER_ARCHIVED",
        "TIME_LOGGED",
        "TIME_LOG_DELETED",
        "SETTINGS_CHANGED",
        "PRODUCT_CREATED",
        "PRODUCT_UPDATED",
        "PRODUCT_CANCELLED",
        "PRODUCT_DELETED",
        "FILE_ADDED",
        "FILE_REMOVED",
      ],
      order_status: ["QUOTE", "IN_PROGRESS", "FINISHED", "BILLED"],
      payment_method: ["INVOICE", "CASH"],
      priority_type: ["NORMAL", "HIGH"],
      product_status: ["IN_SETUP", "PREPRESS", "IN_PRODUCTION", "DONE"],
      textile_design_type: ["TEXT", "FILE"],
      textile_font_class: ["SANS_SERIF", "SERIF", "ELEGANT", "PLAYFUL"],
      user_role: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"],
    },
  },
} as const
