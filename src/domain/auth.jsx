import { createContext, useContext, useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { prepareAccount } from './appointments'
import { supabase } from '../lib/supabase'
export { supabase } from '../lib/supabase'

const Auth = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!supabase)
  const [authLoaded, setAuthLoaded] = useState(!supabase)
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoaded(true)
    })
    const stateListener = Platform.OS === 'web' ? null : AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })
    return () => {
      data.subscription.unsubscribe()
      stateListener?.remove()
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh()
    }
  }, [])

  // Se ejecuta fuera del callback de Auth: evita bloquear internamente al SDK.
  const userId = session?.user.id
  useEffect(() => {
    if (!authLoaded) return
    let active = true
    setAccountError('')
    if (!userId) { setReady(true); return }
    setReady(false)
    prepareAccount().catch((error) => { if (active) setAccountError(error.message) })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [authLoaded, userId])

  return <Auth.Provider value={{ session, ready, accountError }}>{children}</Auth.Provider>
}

export const useAuth = () => useContext(Auth)
