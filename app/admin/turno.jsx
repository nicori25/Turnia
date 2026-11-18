import { useState } from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { BackLink, Button, Card, Heading, Message, Screen, styles } from '../../src/components/ui'
import { Status } from '../../src/components/status'
import { useAgenda } from '../../src/domain/agenda'
import { formatDate, formatPrice } from '../../src/domain/booking'

export default function Turno() {
  const params = useLocalSearchParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const agenda = useAgenda({ id })
  const booking = agenda.records[0]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cancelPrompt, setCancelPrompt] = useState(false)

  if (agenda.ready && !agenda.allowed) return <Redirect href="/admin/login" />

  async function changeStatus(status) {
    if (!booking || busy) return
    setBusy(true)
    setError('')
    try {
      await agenda.changeStatus(booking.id, status)
      setCancelPrompt(false)
    } catch {
      setError('No se pudo actualizar el turno. Volvé a la agenda y revisá su estado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen admin>
      <BackLink href="/admin/panel" children="Agenda" />
      <Heading admin label="Panel del barbero" title="Detalle del turno" />
      {(!agenda.ready || agenda.loading) && <Message>Cargando turno…</Message>}
      {agenda.error ? <Message error>{agenda.error}</Message> : null}
      {agenda.ready && !agenda.loading && !agenda.error && !booking && <Message>El turno no está disponible.</Message>}
      {booking && (
        <>
          <Card>
            <Status status={booking.status} />
            {!agenda.demo && <Text selectable style={styles.caption}>Código de turno: {booking.id}</Text>}
            <Text style={styles.sectionTitle}>{booking.name}</Text>
            <Text style={styles.body}>{booking.service}{booking.vip ? ' · Prioridad VIP' : ''}</Text>
            <Text style={styles.body}>{formatDate(booking.date)} · {booking.time} h</Text>
            {booking.phone ? <Text style={styles.body}>Teléfono: {booking.phone}</Text> : null}
            <Text style={styles.sectionTitle}>Total: {formatPrice(booking.price)}</Text>
          </Card>
          {error ? <Message error>{error}</Message> : null}
          {cancelPrompt ? (
            <Card>
              <Text style={styles.sectionTitle}>¿Querés cancelar este turno?</Text>
              <Button variant="admin" disabled={busy} onPress={() => changeStatus('cancelado')}>Sí, cancelar turno</Button>
              <Button variant="outline" disabled={busy} onPress={() => setCancelPrompt(false)}>Conservar turno</Button>
            </Card>
          ) : (
            <>
              {booking.status === 'pendiente' && (
                <Button variant="admin" disabled={busy} onPress={() => changeStatus('confirmado')}>Confirmar turno</Button>
              )}
              {booking.status !== 'cancelado' && (
                <Button variant="outline" disabled={busy} onPress={() => setCancelPrompt(true)}>Cancelar turno</Button>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  )
}
