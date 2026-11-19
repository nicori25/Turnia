import { reactive } from 'vue'
import { getSupabase, supabase } from '../lib/supabaseClient.js'

export const authState = reactive({ user: null, ready: false, error: '' })
let initialization
export function initAuth() {
  if (initialization) return initialization
  initialization = (async () => {
    try {
      const client = getSupabase()
      client.auth.onAuthStateChange((_event, session) => { authState.user = session?.user ?? null })
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      authState.user = data.session?.user ?? null
    } catch {
      authState.error = supabase ? 'No pudimos recuperar tu sesión. Volvé a iniciar sesión.' : 'Falta configurar Supabase.'
    } finally { authState.ready = true }
  })()
  return initialization
}
export async function register({ email, password, businessName }) {
  const { data, error } = await getSupabase().auth.signUp({ email, password,
    options: { data: { business_name: businessName.trim() } } })
  if (error) throw error
  authState.user = data.session?.user ?? null
  return data
}
export async function login({ email, password }) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
  authState.user = data.session?.user ?? null
  return data
}
export async function logout() {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
  authState.user = null
}
