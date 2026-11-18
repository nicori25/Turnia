import { useCallback, useRef, useState } from 'react'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import { BookingSummary } from '../src/components/booking-summary'
import { BackLink, Button, Card, Field, Heading, Message, Screen } from '../src/components/ui'
import { validCustomer } from '../src/domain/booking'
import { useTurnia } from '../src/domain/turnia'

export default function ConfirmData() {
  const { live, catalog, draft, reserve } = useTurnia()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const focused = useRef(false)
  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => { focused.current = false }
  }, []))
  const service = catalog?.services.find(({ id }) => id === draft.serviceId)

  if (!service || !draft.date || !draft.time) return <Redirect href="/reservar" />

  const surcharge = draft.vip ? catalog.surcharge : 0

  async function submit() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const message = await reserve(name, phone)
      setError(message)
      if (!message && focused.current) router.replace('/confirmacion')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Screen>
      {!busy && <BackLink href="/reservar" children="Servicio y horario" />}
      <Heading label="Reserva · 2 de 3" title="Completá tus datos" subtitle={live ? 'La barbería usará estos datos para gestionar tu turno.'
          : 'Usá un nombre y un teléfono de prueba para esta demostración.'} />
      <BookingSummary service={service.name} date={draft.date} time={draft.time}
        professional={service.professional} business={service.business} surcharge={surcharge} price={service.price + surcharge} />
      <Card>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Alex Pérez" maxLength={80} editable={!busy} />
        <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad"
          placeholder="Ej. 11 1234 5678" maxLength={24} editable={!busy} />
        {error ? <Message error>{error}</Message> : null}
        <Button onPress={submit} disabled={busy || !validCustomer(name, phone)} icon={ArrowRight}>
          {busy ? 'Guardando…' : 'Confirmar turno'}
        </Button>
      </Card>
    </Screen>
  )
}
