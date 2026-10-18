import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when Supabase isn't configured: the app then runs fully offline on this device. */
export const supabase: SupabaseClient | null =
  url && key && !url.includes('your-project-ref') ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export const cloudEnabled = supabase !== null

export interface Profile {
  id: string
  display_name: string | null
  affected_foot: 'left' | 'right' | 'both'
  condition_start: string | null
  physio_name: string | null
  notes: string | null
  settings: Record<string, unknown>
}
