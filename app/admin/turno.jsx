import { useCallback, useRef, useState } from 'react'
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Text } from 'react-native'
import { BackLink, Button, Card, Heading, Message, Screen, styles } from '../../src/components/ui'
import { Status } from '../../src/components/status'
import { useAgenda } from '../../src/domain/agenda'
import { agendaRoute, deleteAppointment, isAppointmentId } from '../../src/domain/appointments'
import { formatDate, formatPrice, isFutureBusinessSlot } from '../../src/domain/booking'
import { useTurnia } from '../../src/domain/turnia'

export default function Turno() {
  const params = useLocalSearchParams()
  const { admin: demo } = useTurnia()
  const id = (demo && typeof params.id === 'string') || isAppointmentId(params.id) ? params.id : ''
  return <AppointmentDetails key={id} id={id} />
}

function AppointmentDetails({ id }) {
  const router = useRouter()
  const agenda = useAgenda({ id })
  const booking = agenda.records[0]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState(null)
  const pending = useRef(false)
  const focused = useRef(false)

  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => { focused.current = false }
  }, []))

  if (agenda.ready && !agenda.allowed) return <Redirect href="/admin/login" />

  async function run(action) {
    if (!booking || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      setPrompt(null)
    } catch (error) {
      setError(error.message)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <Screen admin>
      <BackLink href={agendaRoute(booking?.date)} children="Agenda" />
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
            <Text style={styles.body}>{[booking.service, booking.professional, booking.vip && 'Prioridad VIP'].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.body}>{formatDate(booking.date)} · {booking.time} h</Text>
            {booking.phone ? <Text style={styles.body}>Teléfono: {booking.phone}</Text> : null}
            <Text style={styles.sectionTitle}>Total: {formatPrice(booking.price)}</Text>
          </Card>
          {error ? <Message error>{error}</Message> : null}
          {prompt ? (
            <Card>
              <Text style={styles.sectionTitle}>{prompt === 'delete' ? '¿Querés eliminar este turno?' : '¿Querés cancelar este turno?'}</Text>
              {prompt === 'delete' ? (
                <>
                  <Text style={styles.body}>Se borrará el turno de la agenda de forma permanente.</Text>
                  <Button variant="admin" disabled={busy} onPress={() => run(async () => {
                    const result = await deleteAppointment(booking.id)
                    if (focused.current) router.dismissTo(agendaRoute(result.fecha))
                  })}>Sí, eliminar turno</Button>
                </>
              ) : (
                <Button variant="admin" disabled={busy} onPress={() => run(() => agenda.changeStatus(booking.id, 'cancelado'))}>
                  Sí, cancelar turno
                </Button>
              )}
              <Button variant="outline" disabled={busy} onPress={() => setPrompt(null)}>Conservar turno</Button>
            </Card>
          ) : (
            <>
              {booking.status === 'pendiente' && (agenda.demo || isFutureBusinessSlot(booking.date, booking.time)) && (
                <Button variant="admin" disabled={busy} onPress={() => run(() => agenda.changeStatus(booking.id, 'confirmado'))}>Confirmar turno</Button>
              )}
              {booking.status !== 'cancelado' && (
                <Button variant="outline" disabled={busy} onPress={() => setPrompt('cancel')}>Cancelar turno</Button>
              )}
              {!agenda.demo && (
                <>
                  <Button href={{ pathname: '/admin/editar-turno', params: { id } }} variant="outline" disabled={busy}>Modificar turno</Button>
                  <Button variant="outline" disabled={busy} onPress={() => setPrompt('delete')}>Eliminar turno</Button>
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  )
}
