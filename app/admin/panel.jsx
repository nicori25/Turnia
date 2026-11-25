import { useState } from 'react'
import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import CalendarDays from 'lucide-react-native/icons/calendar-days'
import ChevronLeft from 'lucide-react-native/icons/chevron-left'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import LogOut from 'lucide-react-native/icons/log-out'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, colors, Heading, Message, Screen, styles } from '../../src/components/ui'
import { Status } from '../../src/components/status'
import { useAgenda } from '../../src/domain/agenda'
import { deleteAppointment, isAgendaDate } from '../../src/domain/appointments'
import { useTurnia } from '../../src/domain/turnia'
import { businessDate, formatDate, localDate } from '../../src/domain/booking'

function moveDate(value, offset) {
  const [year, month, day] = value.split('-').map(Number)
  return localDate(new Date(year, month - 1, day + offset))
}

export default function Panel() {
  const { admin: demo } = useTurnia()
  const { date: routeDate } = useLocalSearchParams()
  const date = isAgendaDate(routeDate) ? routeDate : businessDate()
  const [signOutError, setSignOutError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const router = useRouter()
  const agenda = useAgenda({ date })

  if (!agenda.ready) return <Screen admin><Message>Cargando sesión…</Message></Screen>
  if (!agenda.allowed) return <Redirect href="/admin/login" />

  async function signOut() {
    setSignOutError('')
    try {
      await agenda.leave()
      router.replace('/')
    } catch {
      setSignOutError('No pudimos cerrar la sesión. Intentá nuevamente.')
    }
  }

  async function remove() {
    if (!deleteTarget || deleting) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteAppointment(deleteTarget.id)
      setDeleteTarget(null)
      agenda.refresh()
    } catch (error) { setDeleteError(error.message) }
    finally { setDeleting(false) }
  }

  return (
    <Screen admin>
      <View style={panel.header}>
        <View style={panel.heading}>
          <Heading admin label="Panel del barbero" title="Agenda de turnos"
            subtitle={agenda.demo ? 'Martín Barber Studio · Demostración' : 'Consultá y gestioná los turnos de tu barbería.'} />
        </View>
        {agenda.allowed && <Button onPress={signOut} variant="outline" icon={LogOut}>Salir</Button>}
      </View>
      {agenda.ready && agenda.allowed && !agenda.demo && (
        <View style={panel.actions}>
          <Button href={{ pathname: '/admin/editar-turno', params: { date } }} variant="admin">Nuevo turno</Button>
          <Button href="/admin/servicios" variant="outline">Administrar servicios</Button>
          <Button variant="outline" onPress={agenda.refresh} disabled={agenda.loading}>Actualizar agenda</Button>
        </View>
      )}
      {deleteTarget && <Card>
        <Text style={styles.sectionTitle}>¿Eliminar el turno del {formatDate(deleteTarget.date)} a las {deleteTarget.time}?</Text>
        <Text style={styles.body}>Se borrará de forma permanente. Cancelar un turno, en cambio, conserva su registro.</Text>
        {deleteError ? <Message error>{deleteError}</Message> : null}
        <Button variant="admin" disabled={deleting} onPress={remove}>{deleting ? 'Eliminando…' : 'Sí, eliminar turno'}</Button>
        <Button variant="outline" disabled={deleting} onPress={() => setDeleteTarget(null)}>Conservar turno</Button>
      </Card>}
      {signOutError ? <Message error>{signOutError}</Message> : null}
      {agenda.demo && <Message>La agenda de prueba se comparte con las reservas de esta sesión. Al recargar, se restablecen los datos de ejemplo.</Message>}
      <Card>
        <View style={panel.dateBar}>
          <CalendarDays size={19} color={colors.coral} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, panel.date]}>{formatDate(date)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Día anterior" onPress={() => router.setParams({ date: moveDate(date, -1) })} style={panel.dateButton}>
            <ChevronLeft size={21} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Día siguiente" onPress={() => router.setParams({ date: moveDate(date, 1) })} style={panel.dateButton}>
            <ChevronRight size={21} color={colors.text} />
          </Pressable>
        </View>
        {(!agenda.ready || agenda.loading) && <Text style={styles.body}>Cargando agenda…</Text>}
        {agenda.error ? <Message error>{agenda.error}</Message> : null}
        {agenda.ready && !agenda.loading && !agenda.error && !agenda.records.length && (
          <Text style={styles.body}>Todavía no hay turnos para este día.</Text>
        )}
        {agenda.records.map((booking) => (
          <View key={booking.id} style={panel.item}>
          <Link href={{ pathname: '/admin/turno', params: { id: booking.id } }} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={`${booking.time}, ${booking.name}`}
              style={({ hovered, pressed }) => [panel.row, (hovered || pressed) && panel.rowActive]}>
              <Text style={panel.time}>{booking.time}</Text>
              <View style={panel.customer}>
                <Text style={styles.sectionTitle}>{booking.name}</Text>
                <Text style={styles.caption}>{[booking.service, booking.professional, booking.vip && 'VIP'].filter(Boolean).join(' · ')}</Text>
                <Status status={booking.status} />
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          </Link>
          {!agenda.demo && <View style={panel.actions}>
            <Button href={{ pathname: '/admin/turno', params: { id: booking.id } }} variant="outline">Ver</Button>
            <Button href={{ pathname: '/admin/editar-turno', params: { id: booking.id } }} variant="outline">Modificar</Button>
            <Button variant="outline" disabled={deleting} onPress={() => { setDeleteError(''); setDeleteTarget(booking) }}>Eliminar</Button>
          </View>}
          </View>
        ))}
      </Card>
    </Screen>
  )
}

const panel = StyleSheet.create({
  item: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  heading: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateBar: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  date: { flex: 1 },
  dateButton: { alignItems: 'center', justifyContent: 'center', width: 40, height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 7 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 9 },
  rowActive: { borderColor: colors.coral },
  time: { color: colors.coral, fontSize: 16, fontWeight: '800', paddingTop: 1 },
  customer: { flex: 1, gap: 3, minWidth: 0 },
})
