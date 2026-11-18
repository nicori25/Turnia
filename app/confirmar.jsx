import { useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import { BookingSummary } from '../src/components/booking-summary'
import { BackLink, Button, Card, Field, Heading, Message, Screen } from '../src/components/ui'
import { services, validCustomer, vipSurcharge } from '../src/domain/booking'
import { useDemo } from '../src/domain/demo'

export default function ConfirmData() {
  const { draft, reserve } = useDemo()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const service = services.find(({ id }) => id === draft.serviceId)

  if (!service || !draft.date || !draft.time) return <Redirect href="/reservar" />

  function submit() {
    const message = reserve(name, phone)
    setError(message)
    if (!message) router.replace('/confirmacion')
  }

  return (
    <Screen>
      <BackLink href="/reservar" children="Servicio y horario" />
      <Heading label="Reserva · 2 de 3" title="Completá tus datos" subtitle="Usá un nombre y un teléfono de prueba para esta demostración." />
      <BookingSummary service={service.name} date={draft.date} time={draft.time}
        vip={draft.vip} price={service.price + (draft.vip ? vipSurcharge : 0)} />
      <Card>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Alex Pérez" maxLength={80} />
        <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad"
          placeholder="Ej. 11 1234 5678" maxLength={24} />
        {error ? <Message error>{error}</Message> : null}
        <Button onPress={submit} disabled={!validCustomer(name, phone)} icon={ArrowRight}>Confirmar turno</Button>
      </Card>
    </Screen>
  )
}
