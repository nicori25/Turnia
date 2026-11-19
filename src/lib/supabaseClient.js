import { createClient } from '@supabase/supabase-js'

const env = import.meta.env ?? {}
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
let client = null
try {
  if (url && key) client = createClient(url.trim(), key.trim())
} catch {
  // Render the app with an actionable configuration error instead of a blank page.
}
export const supabase = client
export function getSupabase() {
  if (!supabase) throw new Error('Falta configurar la URL y la clave pública de Supabase en el despliegue.')
  return supabase
}
