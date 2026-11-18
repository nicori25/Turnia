import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase, useAuth } from './auth'
import { useDemo } from './demo'

const fields = 'id,hora,fecha,cliente_nombre,cliente_telefono,vip,precio_total,estado,servicios(nombre,duracion_min)'

export function useAgenda({ date, id }) {
  const demo = useDemo()
  const { session, ready } = useAuth()
  const userId = session?.user.id
  const [records, setRecords] = useState([])
  const [loadedQuery, setLoadedQuery] = useState('')
  const [error, setError] = useState('')
  const queryKey = [userId, date, id].join('|')

  useFocusEffect(useCallback(() => {
    if (demo.admin || !userId || (!date && !id)) return
    let active = true
    setError('')
    setLoadedQuery('')

    async function load() {
      try {
        let query = supabase.from('turnos').select(fields).eq('barbero_id', userId)
        query = date ? query.eq('fecha', date).order('hora') : query.eq('id', id)
        const { data, error } = await query
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
          service: row.servicios?.nombre ?? 'Servicio',
          duration: row.servicios?.duracion_min,
        })))
      } catch {
        if (active) setError('No pudimos cargar la agenda. Volvé a abrir la pantalla para reintentar.')
      } finally {
        if (active) setLoadedQuery(queryKey)
      }
    }

    load()
    return () => { active = false }
  }, [date, demo.admin, id, queryKey, userId]))

  async function changeStatus(bookingId, status) {
    if (demo.admin) {
      demo.setStatus(bookingId, status)
      return
    }
    const { data, error } = await supabase.from('turnos').update({ estado: status }).eq('id', bookingId)
      .eq('barbero_id', userId).in('estado', status === 'confirmado' ? ['pendiente'] : ['pendiente', 'confirmado'])
      .select('id')
    if (error || !data?.length) throw new Error('No se pudo actualizar el turno.')
    setRecords((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status } : booking))
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
    error: demo.admin || loadedQuery !== queryKey ? '' : error,
    changeStatus,
    leave: demo.admin ? () => demo.setAdmin(false) : async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }
}
