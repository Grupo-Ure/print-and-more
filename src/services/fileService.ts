import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type FileInsert = Database['public']['Tables']['dateien']['Insert']
type FileRole = Database['public']['Enums']['datei_rolle']

export type FileRow = {
  id: string
  anzeigename: string
  pfad: string
  rolle: FileRole
  erstellt_am: string
}

const FILE_COLUMNS = 'id, anzeigename, pfad, rolle, erstellt_am'

class FileService {
  async getFilesByOrderId(orderId: string): Promise<FileRow[]> {
    const { data, error } = await supabase
      .from('dateien')
      .select(FILE_COLUMNS)
      .eq('auftrag_id', orderId)
    if (error) throw error
    return (data ?? []) as FileRow[]
  }

  async createFile(payload: FileInsert): Promise<FileRow> {
    const { data, error } = await supabase
      .from('dateien')
      .insert(payload)
      .select(FILE_COLUMNS)
      .single()
    if (error) throw error
    return data as FileRow
  }

  async deleteFile(id: string): Promise<void> {
    const { error } = await supabase.from('dateien').delete().eq('id', id)
    if (error) throw error
  }
}

export const fileService = new FileService()
