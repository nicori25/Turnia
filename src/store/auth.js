import { reactive } from 'vue'
import { getSupabase, supabase } from '../lib/supabaseClient.js'
import { prepareAccount } from '../services/turnia.js'

export const authState = reactive({ user: null, ready: false, error: '' })
async function ensureAccount() {
  try { await prepareAccount(); authState.error = '' }
  catch (e) { authState.error = e.message; e.accountSetup = true; throw e }
}
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
      if (authState.user) await ensureAccount()
    } catch (e) {
      authState.error = supabase ? e.message : 'Falta configurar Supabase.'
    } finally { authState.ready = true }
  })()
  return initialization
}
export async function register({ email, password, businessName }) {
  const { data, error } = await getSupabase().auth.signUp({ email, password,
    options: { data: { business_name: businessName.trim() } } })
  if (error) throw error
  authState.user = data.session?.user ?? null
  if (data.session) await ensureAccount()
  return data
}
export async function login({ email, password }) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
  authState.user = data.session?.user ?? null
  await ensureAccount()
  return data
}
export async function logout() {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
  authState.user = null
}
