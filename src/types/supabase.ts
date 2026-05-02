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
      auftraege: {
        Row: {
          archiviert: boolean
          auftragsnummer: string
          erp_exportiert: boolean
          erstellt_am: string
          erstellt_von: string | null
          id: string
          kaufmaennische_notiz: string | null
          kunde_id: string
          lieferung: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv: boolean
          prioritaet: Database["public"]["Enums"]["prioritaet_typ"]
          status: Database["public"]["Enums"]["auftrag_status"]
          termin: string | null
        }
        Insert: {
          archiviert?: boolean
          auftragsnummer: string
          erp_exportiert?: boolean
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kaufmaennische_notiz?: string | null
          kunde_id: string
          lieferung?: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv?: boolean
          prioritaet?: Database["public"]["Enums"]["prioritaet_typ"]
          status?: Database["public"]["Enums"]["auftrag_status"]
          termin?: string | null
        }
        Update: {
          archiviert?: boolean
          auftragsnummer?: string
          erp_exportiert?: boolean
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kaufmaennische_notiz?: string | null
          kunde_id?: string
          lieferung?: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv?: boolean
          prioritaet?: Database["public"]["Enums"]["prioritaet_typ"]
          status?: Database["public"]["Enums"]["auftrag_status"]
          termin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auftraege_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
        ]
      }
      auftragsnummer_counter: {
        Row: {
          jahr: number
          letzter: number
          monat: number
        }
        Insert: {
          jahr: number
          letzter?: number
          monat: number
        }
        Update: {
          jahr?: number
          letzter?: number
          monat?: number
        }
        Relationships: []
      }
      dateien: {
        Row: {
          anzeigename: string
          auftrag_id: string
          ersetzt_datei_id: string | null
          erstellt_am: string
          erstellt_von: string | null
          id: string
          pfad: string
          rolle: Database["public"]["Enums"]["datei_rolle"]
          thumbnail_pfad: string | null
          version: number
        }
        Insert: {
          anzeigename: string
          auftrag_id: string
          ersetzt_datei_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          pfad: string
          rolle?: Database["public"]["Enums"]["datei_rolle"]
          thumbnail_pfad?: string | null
          version?: number
        }
        Update: {
          anzeigename?: string
          auftrag_id?: string
          ersetzt_datei_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          pfad?: string
          rolle?: Database["public"]["Enums"]["datei_rolle"]
          thumbnail_pfad?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dateien_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_ersetzt_datei_id_fkey"
            columns: ["ersetzt_datei_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_exporte: {
        Row: {
          auftrag_id: string
          exportdaten: Json
          exportiert_am: string
          exportiert_von: string | null
          id: string
          modus: string
        }
        Insert: {
          auftrag_id: string
          exportdaten: Json
          exportiert_am?: string
          exportiert_von?: string | null
          id?: string
          modus: string
        }
        Update: {
          auftrag_id?: string
          exportdaten?: Json
          exportiert_am?: string
          exportiert_von?: string | null
          id?: string
          modus?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_exporte_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_exporte_exportiert_von_fkey"
            columns: ["exportiert_von"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      fehler: {
        Row: {
          auftrag_id: string
          erstellt_am: string
          id: string
          person_id: string | null
          teilauftrag_id: string | null
          text: string
        }
        Insert: {
          auftrag_id: string
          erstellt_am?: string
          id?: string
          person_id?: string | null
          teilauftrag_id?: string | null
          text: string
        }
        Update: {
          auftrag_id?: string
          erstellt_am?: string
          id?: string
          person_id?: string | null
          teilauftrag_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "fehler_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fehler_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fehler_teilauftrag_id_fkey"
            columns: ["teilauftrag_id"]
            isOneToOne: false
            referencedRelation: "teilauftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      historie: {
        Row: {
          auftrag_id: string
          begruendung: string | null
          ereignisart: Database["public"]["Enums"]["historie_ereignis"]
          erstellt_am: string
          id: string
          meta: Json | null
          person_id: string | null
          teilauftrag_id: string | null
        }
        Insert: {
          auftrag_id: string
          begruendung?: string | null
          ereignisart: Database["public"]["Enums"]["historie_ereignis"]
          erstellt_am?: string
          id?: string
          meta?: Json | null
          person_id?: string | null
          teilauftrag_id?: string | null
        }
        Update: {
          auftrag_id?: string
          begruendung?: string | null
          ereignisart?: Database["public"]["Enums"]["historie_ereignis"]
          erstellt_am?: string
          id?: string
          meta?: Json | null
          person_id?: string | null
          teilauftrag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historie_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historie_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historie_teilauftrag_id_fkey"
            columns: ["teilauftrag_id"]
            isOneToOne: false
            referencedRelation: "teilauftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      kunden: {
        Row: {
          archiviert: boolean
          email: string | null
          erstellt_am: string
          hausnummer: string | null
          id: string
          name: string
          notiz: string | null
          ort: string | null
          plz: string | null
          strasse: string | null
          telefon: string | null
        }
        Insert: {
          archiviert?: boolean
          email?: string | null
          erstellt_am?: string
          hausnummer?: string | null
          id?: string
          name: string
          notiz?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
        }
        Update: {
          archiviert?: boolean
          email?: string | null
          erstellt_am?: string
          hausnummer?: string | null
          id?: string
          name?: string
          notiz?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
        }
        Relationships: []
      }
      lager_bewegungen: {
        Row: {
          erstellt_am: string
          id: string
          menge: number
          modell_id: string
          notiz: string | null
          person_id: string | null
          typ: string
        }
        Insert: {
          erstellt_am?: string
          id?: string
          menge: number
          modell_id: string
          notiz?: string | null
          person_id?: string | null
          typ: string
        }
        Update: {
          erstellt_am?: string
          id?: string
          menge?: number
          modell_id?: string
          notiz?: string | null
          person_id?: string | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "lager_bewegungen_modell_id_fkey"
            columns: ["modell_id"]
            isOneToOne: false
            referencedRelation: "stempel_modelle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lager_bewegungen_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      stempel_modelle: {
        Row: {
          aktiv: boolean
          artikelnummer: string | null
          bestand: number
          druckflaeche: string | null
          ersatzkissen_artikelnummer: string | null
          erstellt_am: string
          farbe: string | null
          groesse: string | null
          id: string
          max_breite_mm: number | null
          max_hoehe_mm: number | null
          mindestbestand: number
          name: string
          notiz: string | null
          typ: string
          vk_preis_netto: number | null
        }
        Insert: {
          aktiv?: boolean
          artikelnummer?: string | null
          bestand?: number
          druckflaeche?: string | null
          ersatzkissen_artikelnummer?: string | null
          erstellt_am?: string
          farbe?: string | null
          groesse?: string | null
          id?: string
          max_breite_mm?: number | null
          max_hoehe_mm?: number | null
          mindestbestand?: number
          name: string
          notiz?: string | null
          typ: string
          vk_preis_netto?: number | null
        }
        Update: {
          aktiv?: boolean
          artikelnummer?: string | null
          bestand?: number
          druckflaeche?: string | null
          ersatzkissen_artikelnummer?: string | null
          erstellt_am?: string
          farbe?: string | null
          groesse?: string | null
          id?: string
          max_breite_mm?: number | null
          max_hoehe_mm?: number | null
          mindestbestand?: number
          name?: string
          notiz?: string | null
          typ?: string
          vk_preis_netto?: number | null
        }
        Relationships: []
      }
      teilauftraege: {
        Row: {
          auftrag_id: string
          bereich: Database["public"]["Enums"]["teilauftrag_bereich"]
          datenstatus: string | null
          detail: Json
          erstellt_am: string
          id: string
          kundenfreigabe_datei_id: string | null
          kundenfreigabe_erforderlich: boolean
          kundenfreigabe_liegt_vor: boolean
          lieferung: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv: boolean
          notfall_begruendung: string | null
          prioritaet: Database["public"]["Enums"]["prioritaet_typ"]
          satzzeit_minuten: number | null
          sortierung: number
          status: Database["public"]["Enums"]["auftrag_status"]
          storniert: boolean
          termin: string | null
          typ: string | null
          verantwortlicher_id: string | null
        }
        Insert: {
          auftrag_id: string
          bereich: Database["public"]["Enums"]["teilauftrag_bereich"]
          datenstatus?: string | null
          detail?: Json
          erstellt_am?: string
          id?: string
          kundenfreigabe_datei_id?: string | null
          kundenfreigabe_erforderlich?: boolean
          kundenfreigabe_liegt_vor?: boolean
          lieferung?: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv?: boolean
          notfall_begruendung?: string | null
          prioritaet?: Database["public"]["Enums"]["prioritaet_typ"]
          satzzeit_minuten?: number | null
          sortierung?: number
          status?: Database["public"]["Enums"]["auftrag_status"]
          storniert?: boolean
          termin?: string | null
          typ?: string | null
          verantwortlicher_id?: string | null
        }
        Update: {
          auftrag_id?: string
          bereich?: Database["public"]["Enums"]["teilauftrag_bereich"]
          datenstatus?: string | null
          detail?: Json
          erstellt_am?: string
          id?: string
          kundenfreigabe_datei_id?: string | null
          kundenfreigabe_erforderlich?: boolean
          kundenfreigabe_liegt_vor?: boolean
          lieferung?: Database["public"]["Enums"]["lieferung_typ"] | null
          notfall_aktiv?: boolean
          notfall_begruendung?: string | null
          prioritaet?: Database["public"]["Enums"]["prioritaet_typ"]
          satzzeit_minuten?: number | null
          sortierung?: number
          status?: Database["public"]["Enums"]["auftrag_status"]
          storniert?: boolean
          termin?: string | null
          typ?: string | null
          verantwortlicher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_kundenfreigabe_datei"
            columns: ["kundenfreigabe_datei_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teilauftraege_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teilauftraege_verantwortlicher_id_fkey"
            columns: ["verantwortlicher_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_lager_bewegungen: {
        Row: {
          erstellt_am: string
          id: string
          menge: number
          notiz: string | null
          person_id: string | null
          typ: string
          variante_id: string
        }
        Insert: {
          erstellt_am?: string
          id?: string
          menge: number
          notiz?: string | null
          person_id?: string | null
          typ: string
          variante_id: string
        }
        Update: {
          erstellt_am?: string
          id?: string
          menge?: number
          notiz?: string | null
          person_id?: string | null
          typ?: string
          variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textil_lager_bewegungen_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textil_lager_bewegungen_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "textil_varianten"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_marken: {
        Row: {
          aktiv: boolean
          erstellt_am: string
          id: string
          name: string
        }
        Insert: {
          aktiv?: boolean
          erstellt_am?: string
          id?: string
          name: string
        }
        Update: {
          aktiv?: boolean
          erstellt_am?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      textil_motive: {
        Row: {
          datei_id: string | null
          erstellt_am: string
          farbe: string | null
          id: string
          inhalt: string | null
          schriftart: string | null
          schriftklasse:
            | Database["public"]["Enums"]["textil_schriftklasse"]
            | null
          teilauftrag_id: string
          typ: Database["public"]["Enums"]["textil_motiv_typ"]
        }
        Insert: {
          datei_id?: string | null
          erstellt_am?: string
          farbe?: string | null
          id?: string
          inhalt?: string | null
          schriftart?: string | null
          schriftklasse?:
            | Database["public"]["Enums"]["textil_schriftklasse"]
            | null
          teilauftrag_id: string
          typ: Database["public"]["Enums"]["textil_motiv_typ"]
        }
        Update: {
          datei_id?: string | null
          erstellt_am?: string
          farbe?: string | null
          id?: string
          inhalt?: string | null
          schriftart?: string | null
          schriftklasse?:
            | Database["public"]["Enums"]["textil_schriftklasse"]
            | null
          teilauftrag_id?: string
          typ?: Database["public"]["Enums"]["textil_motiv_typ"]
        }
        Relationships: [
          {
            foreignKeyName: "textil_motive_datei_id_fkey"
            columns: ["datei_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textil_motive_teilauftrag_id_fkey"
            columns: ["teilauftrag_id"]
            isOneToOne: false
            referencedRelation: "teilauftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_positionen: {
        Row: {
          erstellt_am: string
          farbe: string | null
          groesse: string | null
          herkunft: Database["public"]["Enums"]["textil_herkunft"]
          id: string
          marke: string | null
          modell: string | null
          stueckzahl: number
          teilauftrag_id: string
          typ: string | null
          variante_id: string | null
        }
        Insert: {
          erstellt_am?: string
          farbe?: string | null
          groesse?: string | null
          herkunft: Database["public"]["Enums"]["textil_herkunft"]
          id?: string
          marke?: string | null
          modell?: string | null
          stueckzahl: number
          teilauftrag_id: string
          typ?: string | null
          variante_id?: string | null
        }
        Update: {
          erstellt_am?: string
          farbe?: string | null
          groesse?: string | null
          herkunft?: Database["public"]["Enums"]["textil_herkunft"]
          id?: string
          marke?: string | null
          modell?: string | null
          stueckzahl?: number
          teilauftrag_id?: string
          typ?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textil_positionen_teilauftrag_id_fkey"
            columns: ["teilauftrag_id"]
            isOneToOne: false
            referencedRelation: "teilauftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textil_positionen_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "textil_varianten"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_produkte: {
        Row: {
          aktiv: boolean
          artikelnummer: string | null
          beschreibung: string | null
          erstellt_am: string
          id: string
          marke_id: string
          name: string
        }
        Insert: {
          aktiv?: boolean
          artikelnummer?: string | null
          beschreibung?: string | null
          erstellt_am?: string
          id?: string
          marke_id: string
          name: string
        }
        Update: {
          aktiv?: boolean
          artikelnummer?: string | null
          beschreibung?: string | null
          erstellt_am?: string
          id?: string
          marke_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "textil_produkte_marke_id_fkey"
            columns: ["marke_id"]
            isOneToOne: false
            referencedRelation: "textil_marken"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_varianten: {
        Row: {
          aktiv: boolean
          bestand: number
          erstellt_am: string
          farbe: string
          farbcode: string | null
          groesse: string
          id: string
          ist_muster: boolean
          mindestbestand: number
          produkt_id: string
          sort_order: number
        }
        Insert: {
          aktiv?: boolean
          bestand?: number
          erstellt_am?: string
          farbe: string
          farbcode?: string | null
          groesse: string
          id?: string
          ist_muster?: boolean
          mindestbestand?: number
          produkt_id: string
          sort_order?: number
        }
        Update: {
          aktiv?: boolean
          bestand?: number
          erstellt_am?: string
          farbe?: string
          farbcode?: string | null
          groesse?: string
          id?: string
          ist_muster?: boolean
          mindestbestand?: number
          produkt_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "textil_varianten_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "textil_produkte"
            referencedColumns: ["id"]
          },
        ]
      }
      textil_zuordnungen: {
        Row: {
          druckart: string | null
          erstellt_am: string
          groesse: string
          id: string
          motiv_id: string
          platz: string
          position_id: string
          teilauftrag_id: string
        }
        Insert: {
          druckart?: string | null
          erstellt_am?: string
          groesse: string
          id?: string
          motiv_id: string
          platz: string
          position_id: string
          teilauftrag_id: string
        }
        Update: {
          druckart?: string | null
          erstellt_am?: string
          groesse?: string
          id?: string
          motiv_id?: string
          platz?: string
          position_id?: string
          teilauftrag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textil_zuordnungen_motiv_id_fkey"
            columns: ["motiv_id"]
            isOneToOne: false
            referencedRelation: "textil_motive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textil_zuordnungen_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "textil_positionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textil_zuordnungen_teilauftrag_id_fkey"
            columns: ["teilauftrag_id"]
            isOneToOne: false
            referencedRelation: "teilauftraege"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mitarbeiter: {
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
      fn_berechne_auftragsstatus: {
        Args: { p_auftrag_id: string }
        Returns: Database["public"]["Enums"]["auftrag_status"]
      }
    }
    Enums: {
      auftrag_status:
        | "ANGEBOT"
        | "UNVOLLSTAENDIG"
        | "PREPRESS_BEREIT"
        | "PRODUKTION_BEREIT"
        | "FERTIG"
        | "ABGERECHNET"
      datei_rolle:
        | "PRODUKTIONSDATEI"
        | "VORSCHAU"
        | "KUNDENFREIGABE"
        | "REFERENZ"
      historie_ereignis:
        | "AUFTRAG_ERSTELLT"
        | "IN_BEARBEITUNG_GENOMMEN"
        | "PREPRESS_BEREIT_AUTO"
        | "PREPRESS_BEREIT_MANUELL"
        | "PRODUKTION_BEREIT_GESETZT"
        | "FERTIG_GEMELDET"
        | "NOTFALL_AUSGELOEST"
        | "KUNDENFREIGABE_AKTIVIERT"
        | "KUNDENFREIGABE_ERTEILT"
        | "KUNDENFREIGABE_VERFALLEN"
        | "KUNDENFREIGABE_UEBERGANGEN"
        | "RUECKSPRUNG"
        | "ERP_EXPORTIERT"
      lieferung_typ: "ABHOLUNG" | "VERSAND"
      prioritaet_typ: "NORMAL" | "HOCH"
      teilauftrag_bereich:
        | "LFP"
        | "COPYSHOP"
        | "TEXTIL"
        | "STEMPEL"
        | "LASERGRAVUR"
        | "SONSTIGE"
      textil_herkunft: "KUNDENWARE" | "EIGENWARE"
      textil_motiv_typ: "TEXT" | "DATEI"
      textil_schriftklasse: "SERIFENLOS" | "SERIFEN" | "ELEGANT" | "VERSPIELT"
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
      auftrag_status: [
        "ANGEBOT",
        "UNVOLLSTAENDIG",
        "PREPRESS_BEREIT",
        "PRODUKTION_BEREIT",
        "FERTIG",
        "ABGERECHNET",
      ],
      datei_rolle: [
        "PRODUKTIONSDATEI",
        "VORSCHAU",
        "KUNDENFREIGABE",
        "REFERENZ",
      ],
      historie_ereignis: [
        "AUFTRAG_ERSTELLT",
        "IN_BEARBEITUNG_GENOMMEN",
        "PREPRESS_BEREIT_AUTO",
        "PREPRESS_BEREIT_MANUELL",
        "PRODUKTION_BEREIT_GESETZT",
        "FERTIG_GEMELDET",
        "NOTFALL_AUSGELOEST",
        "KUNDENFREIGABE_AKTIVIERT",
        "KUNDENFREIGABE_ERTEILT",
        "KUNDENFREIGABE_VERFALLEN",
        "KUNDENFREIGABE_UEBERGANGEN",
        "RUECKSPRUNG",
        "ERP_EXPORTIERT",
      ],
      lieferung_typ: ["ABHOLUNG", "VERSAND"],
      prioritaet_typ: ["NORMAL", "HOCH"],
      teilauftrag_bereich: [
        "LFP",
        "COPYSHOP",
        "TEXTIL",
        "STEMPEL",
        "LASERGRAVUR",
        "SONSTIGE",
      ],
      textil_herkunft: ["KUNDENWARE", "EIGENWARE"],
      textil_motiv_typ: ["TEXT", "DATEI"],
      textil_schriftklasse: ["SERIFENLOS", "SERIFEN", "ELEGANT", "VERSPIELT"],
    },
  },
} as const
