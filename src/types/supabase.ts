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
      banner_products: {
        Row: {
          department_product_id: string
          eyelet_detail: string | null
          eyelets: boolean | null
          height: number | null
          hem: boolean | null
          hem_sides: string | null
          material: string | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          eyelet_detail?: string | null
          eyelets?: boolean | null
          height?: number | null
          hem?: boolean | null
          hem_sides?: string | null
          material?: string | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          eyelet_detail?: string | null
          eyelets?: boolean | null
          height?: number | null
          hem?: boolean | null
          hem_sides?: string | null
          material?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "banner_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      binding_products: {
        Row: {
          binding_color: string | null
          binding_type: string | null
          color_mode: string | null
          department_product_id: string
          format: string | null
          full_bleed: boolean | null
          hardcover_cover: string | null
          hardcover_print: boolean | null
          height: number | null
          material: string | null
          material_other: string | null
          orientation: string | null
          width: number | null
        }
        Insert: {
          binding_color?: string | null
          binding_type?: string | null
          color_mode?: string | null
          department_product_id: string
          format?: string | null
          full_bleed?: boolean | null
          hardcover_cover?: string | null
          hardcover_print?: boolean | null
          height?: number | null
          material?: string | null
          material_other?: string | null
          orientation?: string | null
          width?: number | null
        }
        Update: {
          binding_color?: string | null
          binding_type?: string | null
          color_mode?: string | null
          department_product_id?: string
          format?: string | null
          full_bleed?: boolean | null
          hardcover_cover?: string | null
          hardcover_print?: boolean | null
          height?: number | null
          material?: string | null
          material_other?: string | null
          orientation?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "binding_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          department_product_id: string
          format: string | null
          full_bleed: boolean | null
          height: number | null
          inner_finish: string | null
          inner_material: string | null
          inner_material_other: string | null
          inner_weight: string | null
          orientation: string | null
          page_count: number | null
          production_path: string | null
          width: number | null
        }
        Insert: {
          binding?: string | null
          cover_finish?: string | null
          cover_material?: string | null
          cover_material_other?: string | null
          cover_weight?: string | null
          department_product_id: string
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          inner_finish?: string | null
          inner_material?: string | null
          inner_material_other?: string | null
          inner_weight?: string | null
          orientation?: string | null
          page_count?: number | null
          production_path?: string | null
          width?: number | null
        }
        Update: {
          binding?: string | null
          cover_finish?: string | null
          cover_material?: string | null
          cover_material_other?: string | null
          cover_weight?: string | null
          department_product_id?: string
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          inner_finish?: string | null
          inner_material?: string | null
          inner_material_other?: string | null
          inner_weight?: string | null
          orientation?: string | null
          page_count?: number | null
          production_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brochure_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      business_card_products: {
        Row: {
          color_mode: string | null
          department_product_id: string
          film_laminated: boolean | null
          format: string | null
          full_bleed: boolean | null
          height: number | null
          material: string | null
          multiloft_color: string | null
          orientation: string | null
          width: number | null
        }
        Insert: {
          color_mode?: string | null
          department_product_id: string
          film_laminated?: boolean | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          material?: string | null
          multiloft_color?: string | null
          orientation?: string | null
          width?: number | null
        }
        Update: {
          color_mode?: string | null
          department_product_id?: string
          film_laminated?: boolean | null
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          material?: string | null
          multiloft_color?: string | null
          orientation?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_card_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      card_flyer_products: {
        Row: {
          cc_material: string | null
          cc_material_other: string | null
          color_mode: string | null
          department_product_id: string
          format: string | null
          full_bleed: boolean | null
          height: number | null
          lamination_finish: string | null
          lamination_sides: string | null
          offset_finish: string | null
          offset_type: string | null
          offset_weight: string | null
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
          department_product_id: string
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
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
          department_product_id?: string
          format?: string | null
          full_bleed?: boolean | null
          height?: number | null
          lamination_finish?: string | null
          lamination_sides?: string | null
          offset_finish?: string | null
          offset_type?: string | null
          offset_weight?: string | null
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_flyer_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          department_product_id: string
          description: string | null
          height: number | null
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          department_product_id: string
          description?: string | null
          height?: number | null
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          department_product_id?: string
          description?: string | null
          height?: number | null
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
            foreignKeyName: "date_stamp_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      department_products: {
        Row: {
          created_at: string
          department: string
          id: string
          job_id: string
          notes: string | null
          quantity: number | null
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          job_id: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number
          type: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          job_id?: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_products_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
          department_product_id: string
          height: number | null
          material: string | null
          output: string | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          height?: number | null
          material?: string | null
          output?: string | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          height?: number | null
          material?: string | null
          output?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "foil_plotter_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      folded_flyer_products: {
        Row: {
          cc_material: string | null
          cc_material_other: string | null
          color_mode: string | null
          department_product_id: string
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
          department_product_id: string
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
          department_product_id?: string
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
          production_path?: string | null
          recycling_weight?: string | null
          special_paper?: string | null
          special_paper_other?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folded_flyer_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_item_products: {
        Row: {
          department_product_id: string
          material_free_text: string | null
          motif: string | null
          origin: string | null
        }
        Insert: {
          department_product_id: string
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
        }
        Update: {
          department_product_id?: string
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_item_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      history: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["history_event"]
          id: string
          job_id: string | null
          meta: Json | null
          order_id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["history_event"]
          id?: string
          job_id?: string | null
          meta?: Json | null
          order_id: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["history_event"]
          id?: string
          job_id?: string | null
          meta?: Json | null
          order_id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
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
        ]
      }
      ink_pad_products: {
        Row: {
          color: string | null
          department_product_id: string
          pad_size: string | null
        }
        Insert: {
          color?: string | null
          department_product_id: string
          pad_size?: string | null
        }
        Update: {
          color?: string | null
          department_product_id?: string
          pad_size?: string | null
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
            foreignKeyName: "ink_pad_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      job_number_counter: {
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
            foreignKeyName: "job_number_counter_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          minutes: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          minutes: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          minutes?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_time_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assignee_id: string | null
          created_at: string
          customer_approval_file_id: string | null
          customer_approval_granted: boolean
          customer_approval_required: boolean
          data_status: string | null
          deadline: string | null
          delivery: Database["public"]["Enums"]["delivery_type"] | null
          department: Database["public"]["Enums"]["department"]
          id: string
          is_cancelled: boolean
          job_number: string
          order_id: string
          priority: Database["public"]["Enums"]["priority_type"] | null
          sort_order: number
          status: Database["public"]["Enums"]["job_status"]
          type: string | null
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
          department: Database["public"]["Enums"]["department"]
          id?: string
          is_cancelled?: boolean
          job_number: string
          order_id: string
          priority?: Database["public"]["Enums"]["priority_type"] | null
          sort_order?: number
          status?: Database["public"]["Enums"]["job_status"]
          type?: string | null
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
          department?: Database["public"]["Enums"]["department"]
          id?: string
          is_cancelled?: boolean
          job_number?: string
          order_id?: string
          priority?: Database["public"]["Enums"]["priority_type"] | null
          sort_order?: number
          status?: Database["public"]["Enums"]["job_status"]
          type?: string | null
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
            foreignKeyName: "jobs_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      name_tag_products: {
        Row: {
          department_product_id: string
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "name_tag_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          department_product_id: string
          material_free_text: string | null
          motif: string | null
          origin: string | null
          self_adhesive: boolean | null
        }
        Insert: {
          department_product_id: string
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          self_adhesive?: boolean | null
        }
        Update: {
          department_product_id?: string
          material_free_text?: string | null
          motif?: string | null
          origin?: string | null
          self_adhesive?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "other_laser_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_lfp_products: {
        Row: {
          department_product_id: string
          description: string | null
        }
        Insert: {
          department_product_id: string
          description?: string | null
        }
        Update: {
          department_product_id?: string
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_lfp_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_products: {
        Row: {
          department_product_id: string
          description: string | null
        }
        Insert: {
          department_product_id: string
          description?: string | null
        }
        Update: {
          department_product_id?: string
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      other_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          department_product_id: string
          description: string | null
          height: number | null
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          department_product_id: string
          description?: string | null
          height?: number | null
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          department_product_id?: string
          description?: string | null
          height?: number | null
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
            foreignKeyName: "other_stamp_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_products: {
        Row: {
          department_product_id: string
          format: string | null
          height: number | null
          laminate: string | null
          material: string | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          format?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          format?: string | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      printout_products: {
        Row: {
          color_mode: string | null
          department_product_id: string
          format: string | null
          laminate: string | null
          material: string | null
          material_other: string | null
          punching: string | null
          staple: boolean | null
        }
        Insert: {
          color_mode?: string | null
          department_product_id: string
          format?: string | null
          laminate?: string | null
          material?: string | null
          material_other?: string | null
          punching?: string | null
          staple?: boolean | null
        }
        Update: {
          color_mode?: string | null
          department_product_id?: string
          format?: string | null
          laminate?: string | null
          material?: string | null
          material_other?: string | null
          punching?: string | null
          staple?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "printout_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          created_at: string
          department_product_id: string
          file_id: string
          id: string
        }
        Insert: {
          created_at?: string
          department_product_id: string
          file_id: string
          id?: string
        }
        Update: {
          created_at?: string
          department_product_id?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: false
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      refill_ink_products: {
        Row: {
          color: string | null
          department_product_id: string
          ink_type: string | null
        }
        Insert: {
          color?: string | null
          department_product_id: string
          ink_type?: string | null
        }
        Update: {
          color?: string | null
          department_product_id?: string
          ink_type?: string | null
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
            foreignKeyName: "refill_ink_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      rollup_products: {
        Row: {
          department_product_id: string
          material: string | null
          rollup_system: string | null
          rollup_width: number | null
        }
        Insert: {
          department_product_id: string
          material?: string | null
          rollup_system?: string | null
          rollup_width?: number | null
        }
        Update: {
          department_product_id?: string
          material?: string | null
          rollup_system?: string | null
          rollup_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rollup_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_foil_products: {
        Row: {
          department_product_id: string
          drill_hole_diameter: number | null
          drill_hole_position: string | null
          drill_holes: boolean | null
          height: number | null
          laminate: string | null
          material: string | null
          print_side: string | null
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          print_side?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          laminate?: string | null
          material?: string | null
          print_side?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_foil_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_products: {
        Row: {
          department_product_id: string
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          round_corners: boolean | null
          self_adhesive: boolean | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_uv_products: {
        Row: {
          acrylic_print_direction: string | null
          department_product_id: string
          drill_hole_diameter: number | null
          drill_hole_position: string | null
          drill_holes: boolean | null
          height: number | null
          material: string | null
          print_side: string | null
          round_corners: boolean | null
          width: number | null
        }
        Insert: {
          acrylic_print_direction?: string | null
          department_product_id: string
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          material?: string | null
          print_side?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Update: {
          acrylic_print_direction?: string | null
          department_product_id?: string
          drill_hole_diameter?: number | null
          drill_hole_position?: string | null
          drill_holes?: boolean | null
          height?: number | null
          material?: string | null
          print_side?: string | null
          round_corners?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_uv_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          department_product_id: string
          height: number | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          height?: number | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          height?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stamp_plate_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          department_product_id: string
          description: string | null
          height: number | null
          width: number | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          department_product_id: string
          description?: string | null
          height?: number | null
          width?: number | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          department_product_id?: string
          description?: string | null
          height?: number | null
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
            foreignKeyName: "stand_stamp_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_products: {
        Row: {
          contour_cut: string | null
          department_product_id: string
          height: number | null
          laminate: string | null
          material: string | null
          material_variant: string | null
          output: string | null
          width: number | null
        }
        Insert: {
          contour_cut?: string | null
          department_product_id: string
          height?: number | null
          laminate?: string | null
          material?: string | null
          material_variant?: string | null
          output?: string | null
          width?: number | null
        }
        Update: {
          contour_cut?: string | null
          department_product_id?: string
          height?: number | null
          laminate?: string | null
          material?: string | null
          material_variant?: string | null
          output?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sticker_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
      textile_garment_products: {
        Row: {
          brand: string | null
          color: string | null
          department_product_id: string
          garment_type: string | null
          model: string | null
          origin: string | null
          size: string | null
          variant_id: string | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          department_product_id: string
          garment_type?: string | null
          model?: string | null
          origin?: string | null
          size?: string | null
          variant_id?: string | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          department_product_id?: string
          garment_type?: string | null
          model?: string | null
          origin?: string | null
          size?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textile_garment_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_garment_products_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "textile_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      textile_motif_links: {
        Row: {
          created_at: string
          department_product_id: string
          id: string
          motif_id: string
          placement: string
          print_method: string | null
          size: string
        }
        Insert: {
          created_at?: string
          department_product_id: string
          id?: string
          motif_id: string
          placement: string
          print_method?: string | null
          size: string
        }
        Update: {
          created_at?: string
          department_product_id?: string
          id?: string
          motif_id?: string
          placement?: string
          print_method?: string | null
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "textile_motif_links_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: false
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textile_motif_links_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "textile_motifs"
            referencedColumns: ["id"]
          },
        ]
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
          job_id: string
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
          job_id: string
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
          job_id?: string
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
            foreignKeyName: "textile_motifs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
          is_default: boolean
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
          is_default?: boolean
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
          is_default?: boolean
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
      trodat_pad_products: {
        Row: {
          color: string | null
          department_product_id: string
          pad_article_number: string | null
          pad_variant_id: string | null
        }
        Insert: {
          color?: string | null
          department_product_id: string
          pad_article_number?: string | null
          pad_variant_id?: string | null
        }
        Update: {
          color?: string | null
          department_product_id?: string
          pad_article_number?: string | null
          pad_variant_id?: string | null
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
            foreignKeyName: "trodat_pad_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trodat_pad_products_pad_variant_id_fkey"
            columns: ["pad_variant_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
        ]
      }
      trodat_printy_products: {
        Row: {
          color: string | null
          color_other: string | null
          department_product_id: string
          description: string | null
          model_id: string | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          department_product_id: string
          description?: string | null
          model_id?: string | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          department_product_id?: string
          description?: string | null
          model_id?: string | null
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
            foreignKeyName: "trodat_printy_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trodat_printy_products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
            referencedColumns: ["id"]
          },
        ]
      }
      trophy_plate_products: {
        Row: {
          department_product_id: string
          height: number | null
          material: string | null
          material_other: string | null
          motif: string | null
          round_corners: boolean | null
          self_adhesive: boolean | null
          width: number | null
        }
        Insert: {
          department_product_id: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Update: {
          department_product_id?: string
          height?: number | null
          material?: string | null
          material_other?: string | null
          motif?: string | null
          round_corners?: boolean | null
          self_adhesive?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trophy_plate_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
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
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
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
          department_product_id: string
          existing_wrap: boolean | null
          installation: string | null
          installation_date: string | null
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          area_front?: boolean | null
          area_rear?: boolean | null
          area_sides?: boolean | null
          department_product_id: string
          existing_wrap?: boolean | null
          installation?: string | null
          installation_date?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          area_front?: boolean | null
          area_rear?: boolean | null
          area_sides?: boolean | null
          department_product_id?: string
          existing_wrap?: boolean | null
          installation?: string | null
          installation_date?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_lettering_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
        ]
      }
      wooden_stamp_products: {
        Row: {
          color: string | null
          color_other: string | null
          department_product_id: string
          description: string | null
          model_id: string | null
        }
        Insert: {
          color?: string | null
          color_other?: string | null
          department_product_id: string
          description?: string | null
          model_id?: string | null
        }
        Update: {
          color?: string | null
          color_other?: string | null
          department_product_id?: string
          description?: string | null
          model_id?: string | null
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
            foreignKeyName: "wooden_stamp_products_department_product_id_fkey"
            columns: ["department_product_id"]
            isOneToOne: true
            referencedRelation: "department_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wooden_stamp_products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "stamp_models"
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
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      duplicate_order: {
        Args: {
          created_by_user_id: string
          new_deadline: string
          new_delivery: Database["public"]["Enums"]["delivery_type"]
          new_priority: Database["public"]["Enums"]["priority_type"]
          selected_job_ids: string[]
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
      department:
        | "LFP"
        | "COPYSHOP"
        | "TEXTILE"
        | "STAMP"
        | "LASER_ENGRAVING"
        | "OTHER"
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
        | "JOB_CREATED"
        | "JOB_CANCELLED"
        | "JOB_DELETED"
        | "SETTINGS_CHANGED"
        | "PRODUCT_CREATED"
        | "PRODUCT_UPDATED"
        | "PRODUCT_DELETED"
        | "FILE_ADDED"
        | "FILE_REMOVED"
      job_status: "IN_SETUP" | "PREPRESS" | "IN_PRODUCTION" | "DONE"
      order_status: "QUOTE" | "IN_PROGRESS" | "FINISHED" | "BILLED"
      payment_method: "INVOICE" | "CASH"
      priority_type: "NORMAL" | "HIGH"
      textile_font_class: "SANS_SERIF" | "SERIF" | "ELEGANT" | "PLAYFUL"
      textile_motif_type: "TEXT" | "FILE"
      textile_origin: "CUSTOMER_STOCK" | "OWN_STOCK"
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
      department: [
        "LFP",
        "COPYSHOP",
        "TEXTILE",
        "STAMP",
        "LASER_ENGRAVING",
        "OTHER",
      ],
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
        "JOB_CREATED",
        "JOB_CANCELLED",
        "JOB_DELETED",
        "SETTINGS_CHANGED",
        "PRODUCT_CREATED",
        "PRODUCT_UPDATED",
        "PRODUCT_DELETED",
        "FILE_ADDED",
        "FILE_REMOVED",
      ],
      job_status: ["IN_SETUP", "PREPRESS", "IN_PRODUCTION", "DONE"],
      order_status: ["QUOTE", "IN_PROGRESS", "FINISHED", "BILLED"],
      payment_method: ["INVOICE", "CASH"],
      priority_type: ["NORMAL", "HIGH"],
      textile_font_class: ["SANS_SERIF", "SERIF", "ELEGANT", "PLAYFUL"],
      textile_motif_type: ["TEXT", "FILE"],
      textile_origin: ["CUSTOMER_STOCK", "OWN_STOCK"],
      user_role: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"],
    },
  },
} as const

