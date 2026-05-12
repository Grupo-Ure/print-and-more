import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type FileInsert = Database['public']['Tables']['files']['Insert']
export type FileRole = Database['public']['Enums']['file_role']

export type FileRow = {
  id: string
  display_name: string
  path: string
  role: FileRole
  created_at: string
}

const FILE_COLUMNS = 'id, display_name, path, role, created_at'

class FileService {
  async getFilesByOrderId(orderId: string): Promise<FileRow[]> {
    const { data, error } = await supabase
      .from('files')
      .select(FILE_COLUMNS)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as FileRow[]
  }

  async createFile(payload: FileInsert): Promise<FileRow> {
    const { data, error } = await supabase
      .from('files')
      .insert(payload)
      .select(FILE_COLUMNS)
      .single()
    if (error) throw error
    return data as FileRow
  }

  async deleteFile(id: string): Promise<void> {
    const { error } = await supabase.from('files').delete().eq('id', id)
    if (error) throw error
  }
}

export const fileService = new FileService()
