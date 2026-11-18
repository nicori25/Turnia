import { useCallback, useRef, useState } from 'react'
import { Redirect, useFocusEffect } from 'expo-router'
import { Text, View } from 'react-native'
import { BackLink, Button, Card, Field, Heading, Message, Screen, styles } from '../../src/components/ui'
import { supabase, useAuth } from '../../src/domain/auth'
import { formatPrice } from '../../src/domain/booking'
import { useTurnia } from '../../src/domain/turnia'

const emptyForm = { name: '', duration: '', price: '' }

export default function Services() {
  const { session, ready } = useAuth()
  const { reloadCatalog } = useTurnia()
  const userId = session?.user.id
  const [entries, setEntries] = useState([])
  const [draft, setDraft] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const inFlight = useRef(false)

  useFocusEffect(useCallback(() => {
    if (!userId) return
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    setEntries([])

    async function load() {
      try {
        const { data, error } = await supabase.from('servicios')
          .select('id,nombre,duracion_min,precio,activo').eq('barbero_id', userId).order('nombre')
          .abortSignal(controller.signal)
        if (error) throw error
        if (!controller.signal.aborted) setEntries(data)
      } catch {
        if (!controller.signal.aborted) setLoadError('No pudimos cargar tus servicios.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [revision, userId]))

  if (ready && !userId) return <Redirect href="/admin/login" />

  const duration = Number(draft.duration)
  const price = Number(draft.price.replace(',', '.'))
  const valid = draft.name.trim().length >= 2 && /^\d{1,3}$/.test(draft.duration) && duration >= 1 && duration <= 240
    && /^\d{1,8}([,.]\d{1,2})?$/.test(draft.price) && price <= 99998499.99

  function edit(service) {
    setFormError('')
    setEditing(service?.id ?? null)
    setDraft(service ? { name: service.nombre, duration: String(service.duracion_min), price: String(service.precio) } : emptyForm)
  }

  async function save(values, id) {
    if (!userId || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setFormError('')
    try {
      const query = id
        ? supabase.from('servicios').update(values).eq('id', id).eq('barbero_id', userId)
        : supabase.from('servicios').insert({ ...values, barbero_id: userId })
      const { error } = await query.select('id').single()
      if (error) throw error
      if (!id || id === editing) edit(null)
      setRevision((value) => value + 1)
      reloadCatalog()
    } catch {
      setFormError('No pudimos guardar el servicio. Revisá los datos e intentá de nuevo.')
    } finally {
      setSaving(false)
      inFlight.current = false
    }
  }

  return (
    <Screen admin>
      <BackLink href="/admin/panel" children="Agenda" />
      <Heading admin label="Panel del barbero" title="Administrá tus servicios"
        subtitle="Los servicios activos aparecen en el catálogo de reservas." />
      {loading && <Message>Cargando servicios…</Message>}
      {loadError && (
        <>
          <Message error>{loadError}</Message>
          <Button variant="outline" onPress={() => setRevision((value) => value + 1)}>Reintentar</Button>
        </>
      )}
      {!loading && !loadError && !entries.length && <Message>Todavía no cargaste servicios.</Message>}
      {entries.map((service) => (
        <Card key={service.id}>
          <Text style={styles.sectionTitle}>{service.nombre}</Text>
          <Text style={styles.body}>{service.duracion_min} min · {formatPrice(service.precio)} · {service.activo ? 'Activo' : 'Pausado'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="outline" disabled={saving} onPress={() => edit(service)}>Editar</Button>
            <Button variant="outline" disabled={saving} onPress={() => save({ activo: !service.activo }, service.id)}>
              {service.activo ? 'Pausar' : 'Activar'}
            </Button>
          </View>
        </Card>
      ))}
      {userId && (
        <Card>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{editing ? 'Editar servicio' : 'Nuevo servicio'}</Text>
          <Field label="Nombre" value={draft.name} maxLength={80} editable={!saving}
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))} />
          <Field label="Duración en minutos" value={draft.duration} keyboardType="number-pad" maxLength={3} editable={!saving}
            onChangeText={(duration) => setDraft((current) => ({ ...current, duration }))} />
          <Field label="Precio en pesos" value={draft.price} keyboardType="decimal-pad" maxLength={11} editable={!saving}
            onChangeText={(price) => setDraft((current) => ({ ...current, price }))} />
          {formError && <Message error>{formError}</Message>}
          <Button variant="admin" disabled={!valid || saving} onPress={() => save({
            nombre: draft.name.trim(), duracion_min: duration, precio: price,
          }, editing)}>{saving ? 'Guardando…' : 'Guardar servicio'}</Button>
          {editing && <Button variant="text" disabled={saving} onPress={() => edit(null)}>Cancelar edición</Button>}
        </Card>
      )}
    </Screen>
  )
}
