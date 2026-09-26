import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em apps/vendas/.env.local')
}

// Cliente único do app. Usa só a chave pública: quem limita o acesso é a RLS.
export const supabase = createClient<Database>(url, anonKey)
