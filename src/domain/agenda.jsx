import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase, useAuth } from './auth'
import { useBusinessClock } from './use-business-clock'
import { updateAppointmentStatus } from './appointments'
import { useTurnia } from './turnia'

export function useAgenda({ date, id }) {
  const demo = useTurnia()
  const now = useBusinessClock()
  const { session, ready, accountError } = useAuth()
  const userId = session?.user.id
  const [records, setRecords] = useState([])
  const [loadedQuery, setLoadedQuery] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const queryKey = [userId, date, id].join('|')

  useFocusEffect(useCallback(() => {
    if (demo.admin || !ready || !userId || (!date && !id)) return
    let active = true
    setError('')
    setLoadedQuery((loaded) => loaded === queryKey ? loaded : '')

    async function load() {
      try {
        let { data, error } = await supabase.rpc('turnia_v2_agenda', {
          p_fecha: date ?? null, p_id: id || null,
        })
        if (['PGRST202', '42883'].includes(error?.code)) ({ data, error } = await supabase.rpc('mi_agenda_turnia', {
          p_fecha: date ?? null,
          p_turno_id: id || null,
        }))
        if (error) throw error
        if (!active) return
        setRecords(data.map((row) => ({
          id: row.id,
          date: row.fecha,
          time: row.hora.slice(0, 5),
          name: row.cliente_nombre,
          phone: row.cliente_telefono,
          vip: row.vip,
          price: row.precio_total,
          status: row.estado,
          service: row.servicio_nombre,
          duration: row.duracion_min,
          professional: row.profesional,
        })))
      } catch {
        if (active) setError('No pudimos cargar la agenda. Volvé a abrir la pantalla para reintentar.')
      } finally {
        if (active) setLoadedQuery(queryKey)
      }
    }

    load()
    return () => { active = false }
  }, [date, demo.admin, id, queryKey, revision, userId, ready, now]))

  async function changeStatus(bookingId, status) {
    if (demo.admin) {
      demo.setStatus(bookingId, status)
      return
    }
    const result = await updateAppointmentStatus(bookingId, status)
    setRecords((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: result.estado } : booking))
  }

  const demoRecords = demo.bookings
    .filter((booking) => date ? booking.date === date : booking.id === id)
    .sort((a, b) => a.time.localeCompare(b.time))

  return {
    allowed: demo.admin || !!userId,
    demo: demo.admin,
    ready: demo.admin || ready,
    loading: !demo.admin && !!userId && !!(date || id) && loadedQuery !== queryKey,
    records: demo.admin ? demoRecords : loadedQuery === queryKey && !error ? records : [],
    error: demo.admin ? '' : accountError || (loadedQuery === queryKey ? error : ''),
    refresh: () => setRevision((value) => value + 1),
    changeStatus,
    leave: demo.admin ? () => demo.setAdmin(false) : async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }
}
