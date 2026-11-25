import { useCallback, useEffect, useRef, useState } from 'react'
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { BackLink, Button, Card, colors, Field, Heading, Message, Screen, styles } from '../../src/components/ui'
import {
  agendaRoute, appointmentStates, isAgendaDate, isAppointmentId, loadAppointment,
  loadAppointmentOptions, saveAppointment, validAppointmentCustomer,
} from '../../src/domain/appointments'
import { useAuth } from '../../src/domain/auth'
import { businessDate, formatPrice, isFutureBusinessSlot, timeSlots, vipSurcharge } from '../../src/domain/booking'
import { useTurnia } from '../../src/domain/turnia'

function Choices({ label, items, value, onChange, disabled }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={formStyles.choices}>
        {items.map((item) => (
          <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === value, disabled }}
            disabled={disabled} onPress={() => onChange(item.id)}
            style={[formStyles.choice, item.id === value && formStyles.selected]}>
            <Text style={styles.fieldLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function AppointmentForm({ id, initialDate }) {
  const router = useRouter()
  const [form, setForm] = useState(null)
  const [initial, setInitial] = useState(null)
  const [options, setOptions] = useState(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const focused = useRef(false)
  const request = useRef(null)

  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => { focused.current = false }
  }, []))

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      loadAppointmentOptions(controller.signal),
      id ? loadAppointment(id, controller.signal) : null,
    ]).then(([choices, record]) => {
      if (controller.signal.aborted) return
      if (id && !record) throw new Error('El turno no está disponible.')
      setOptions(choices)
      setInitial(record)
      setForm(record ?? {
        professionalId: choices.profesionales[0]?.id ?? '', serviceId: '',
        date: initialDate >= businessDate() ? initialDate : businessDate(), time: '',
        name: '', phone: '', vip: false, status: 'pendiente',
      })
    }).catch((error) => {
      if (!controller.signal.aborted) setError(error.message)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [id, initialDate, revision])

  const professionals = options?.profesionales ?? []
  const services = options?.servicios.filter(({ profesional_id }) => !profesional_id || profesional_id === form?.professionalId) ?? []
  const service = services.find(({ id }) => id === form?.serviceId)
  const historicalUnchanged = initial && ['date', 'time', 'professionalId', 'serviceId', 'status']
    .every((key) => initial[key] === form[key])
  const validSlot = form && isAgendaDate(form.date) && timeSlots.includes(form.time)
    && (historicalUnchanged || isFutureBusinessSlot(form.date, form.time))
  const valid = validSlot && service && professionals.some(({ id }) => id === form.professionalId)
    && validAppointmentCustomer(form.name, form.phone)

  function update(changes) {
    setError('')
    setForm((current) => ({ ...current, ...changes }))
  }

  async function submit() {
    if (!valid || pending.current) return
    pending.current = true
    setSaving(true)
    setError('')
    const signature = JSON.stringify({ ...form, name: form.name.trim(), phone: form.phone.trim() })
    if (!id && request.current?.signature !== signature) request.current = { signature, id: randomUUID() }
    try {
      const result = await saveAppointment(id, form, id ? null : request.current.id)
      if (focused.current) router.dismissTo(agendaRoute(result.fecha))
    } catch (error) {
      setError(error.message)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <Screen admin>
      {!saving && <BackLink href={id ? { pathname: '/admin/turno', params: { id } } : agendaRoute(initialDate)}>Volver</BackLink>}
      <Heading admin title={id ? 'Modificar turno' : 'Nuevo turno'} />
      {loading && <Message>Cargando datos del turno…</Message>}
      {!loading && !form && (
        <>
          <Message error>{error || 'No pudimos abrir el formulario.'}</Message>
          <Button variant="outline" onPress={() => setRevision((value) => value + 1)}>Reintentar</Button>
        </>
      )}
      {form && !professionals.length && <Message>No hay profesionales activos disponibles para tu cuenta.</Message>}
      {form && professionals.length > 0 && (
        <Card>
          <Choices label="Profesional" items={professionals.map((item) => ({ id: item.id, label: item.nombre }))}
            value={form.professionalId} disabled={saving} onChange={(professionalId) => {
              if (professionalId !== form.professionalId) update({ professionalId, serviceId: '' })
            }} />
          <Choices label="Servicio" items={services.map((item) => ({ id: item.id, label: `${item.nombre} · ${item.duracion_min} min` }))}
            value={form.serviceId} disabled={saving} onChange={(serviceId) => update({ serviceId })} />
          {!services.length && <Message>Este profesional todavía no tiene servicios activos.</Message>}
          {initial && (!service || !professionals.some(({ id }) => id === form.professionalId)) && (
            <Message>Para guardar, elegí un profesional y un servicio activos.</Message>
          )}
          <Field label="Fecha (AAAA-MM-DD)" value={form.date} placeholder="AAAA-MM-DD" maxLength={10}
            autoCorrect={false} editable={!saving} onChangeText={(date) => update({ date })} />
          <Choices label="Horario de Buenos Aires" items={timeSlots.map((time) => ({ id: time, label: time }))}
            value={form.time} disabled={saving} onChange={(time) => update({ time })} />
          {form.date && form.time && !validSlot && <Text style={styles.caption}>Ingresá una fecha válida y elegí un horario futuro.</Text>}
          <Field label="Nombre del cliente" value={form.name} maxLength={100}
            editable={!saving} onChangeText={(name) => update({ name })} />
          <Field label="Teléfono del cliente" value={form.phone} maxLength={30} keyboardType="phone-pad"
            editable={!saving} onChangeText={(phone) => update({ phone })} />
          <Choices label="Estado" items={Object.entries(appointmentStates).map(([id, label]) => ({ id, label }))}
            value={form.status} disabled={saving} onChange={(status) => update({ status })} />
          <View style={formStyles.vip}>
            <Text style={styles.fieldLabel}>Prioridad VIP · +{formatPrice(vipSurcharge)}</Text>
            <Switch accessibilityLabel="Prioridad VIP" value={form.vip} disabled={saving}
              onValueChange={(vip) => update({ vip })} />
          </View>
          {service && <Text style={styles.sectionTitle}>Total: {formatPrice(Number(service.precio) + (form.vip ? vipSurcharge : 0))}</Text>}
          {error && <Message error>{error}</Message>}
          <Button variant="admin" disabled={!valid || saving} onPress={submit}>
            {saving ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear turno'}
          </Button>
        </Card>
      )}
    </Screen>
  )
}

export default function EditAppointment() {
  const { id, date } = useLocalSearchParams()
  const { session, ready } = useAuth()
  const { admin: demo } = useTurnia()
  if (demo) return <Redirect href="/admin/panel" />
  if (!ready) return <Screen admin><Message>Cargando sesión…</Message></Screen>
  if (!session) return <Redirect href="/admin/login" />
  if (id !== undefined && !isAppointmentId(id)) {
    return <Screen admin><BackLink href="/admin/panel">Agenda</BackLink><Message error>El código de turno no es válido.</Message></Screen>
  }
  const initialDate = isAgendaDate(date) ? date : ''
  return <AppointmentForm key={[session.user.id, id, initialDate].join(':')} id={id ?? null} initialDate={initialDate} />
}

const formStyles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, backgroundColor: colors.bg },
  selected: { borderColor: colors.coral, backgroundColor: colors.coralDark },
  vip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
})
