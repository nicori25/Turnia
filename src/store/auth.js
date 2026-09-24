import { reactive } from 'vue'
import { supabase } from '../lib/supabaseClient'

// El barbero es quien tiene cuenta en Turnia; el cliente reserva sin
// registrarse (ver el MVP del proyecto).
export const authState = reactive({
  user: null,
  ready: false,
})

export async function initAuth() {
  const { data } = await supabase.auth.getSession()
  authState.user = data.session?.user ?? null
  authState.ready = true

  supabase.auth.onAuthStateChange((_event, session) => {
    authState.user = session?.user ?? null
  })
}

export async function register({ email, password, businessName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { business_name: businessName } },
  })
  if (error) throw error
  authState.user = data.user
  return data
}

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  authState.user = data.user
  return data
}

export async function logout() {
  await supabase.auth.signOut()
  authState.user = null
}
