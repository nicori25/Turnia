import { useState } from 'react'
import { useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import { BackLink, Button, Card, Field, Heading, Message, Screen } from './ui'
import { supabase, useAuth } from '../domain/auth'
import { useTurnia } from '../domain/turnia'

export function AuthForm({ register = false }) {
  const router = useRouter()
  const { session } = useAuth()
  const { setAdmin } = useTurnia()
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && password.length >= 6 && (!register || businessName.trim().length >= 2)

  function enterDemo() {
    setAdmin(true)
    router.replace('/admin/panel')
  }

  async function openAgenda(activeSession) {
    try {
      const { data, error } = await supabase.rpc('preparar_cuenta_turnia', {
        p_nombre: activeSession.user.user_metadata?.business_name ?? null,
      })
      if (error) throw error
      if (!data) {
        setError('Tu cuenta todavía no tiene un perfil de Turnia.')
        return
      }
      setAdmin(false)
      router.replace('/admin/panel')
    } catch {
      setError('No pudimos preparar tu agenda. Intentá nuevamente.')
    }
  }

  async function submit() {
    if (!supabase || !valid || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const credentials = { email: email.trim(), password }
    try {
      const { data, error } = register
        ? await supabase.auth.signUp({ ...credentials, options: { data: { business_name: businessName.trim() } } })
        : await supabase.auth.signInWithPassword(credentials)
      if (error) {
        setError(register ? 'No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.' : 'No pudimos iniciar sesión. Revisá tus credenciales.')
      } else if (data.session) {
        await openAgenda(data.session)
      } else {
        setNotice('Revisá tu correo para confirmar el registro. Después podés iniciar sesión.')
      }
    } catch {
      setError('No pudimos conectarnos. Intentá nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen admin>
      <BackLink href={register ? '/admin/login' : '/'} children={register ? 'Acceso del barbero' : 'Inicio'} />
      <Heading admin label="Panel del barbero" title={register ? 'Creá tu cuenta' : 'Ingresá a tu agenda'}
        subtitle={register ? 'Registrá los datos de tu barbería.' : 'Consultá, confirmá y cancelá turnos.'} />
      <Card>
        {supabase ? (
          <>
            {register && <Field label="Nombre de la barbería" value={businessName} onChangeText={setBusinessName} maxLength={100} />}
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" placeholder="barbero@ejemplo.com" />
            <Field label="Contraseña" value={password} onChangeText={setPassword}
              secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} />
            {error ? <Message error>{error}</Message> : null}
            {notice ? <Message>{notice}</Message> : null}
            <Button onPress={submit} disabled={!valid || busy} variant="admin" icon={ArrowRight}>
              {busy ? 'Procesando…' : register ? 'Registrarme' : 'Entrar'}
            </Button>
            {!register && session && (
              <Button onPress={() => openAgenda(session)} variant="outline" disabled={busy}>
                Abrir mi agenda
              </Button>
            )}
          </>
        ) : <Message>El acceso con cuenta está pendiente de configuración. Podés recorrer la agenda con datos de prueba.</Message>}
        {!register && <Button onPress={enterDemo} variant={supabase ? 'outline' : 'admin'} icon={ArrowRight}>Entrar a la demo</Button>}
        <Button href={register ? '/admin/login' : '/admin/registro'} variant="text">
          {register ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
        </Button>
      </Card>
    </Screen>
  )
}
