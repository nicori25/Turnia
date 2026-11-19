import { getSupabase } from '../lib/supabaseClient.js'

export function publicError(error) {
  const message = error?.message ?? ''
  if (/ocupado|unique|23505/i.test(message) || error?.code === '23505') return 'Ese horario ya fue aceptado. Elegí otro horario.'
  if (/pasado/i.test(message)) return 'La fecha o el horario ya pasaron. Elegí otro turno.'
  if (/Teléfono inválido|Nombre inválido|Estado inválido|ya utilizado/i.test(message)) return message
  if (/42501|permiso|Sesión requerida/i.test(message) || error?.code === '42501') return 'No tenés permiso para realizar esta operación. Volvé a iniciar sesión.'
  if (/PGRST202|PGRST205|42883|42P01/.test(error?.code ?? '')) return 'Falta aplicar la actualización de la base de datos en Supabase.'
  if (/Falta configurar/.test(message)) return message
  return 'No pudimos conectar con Supabase. Revisá tu conexión y volvé a intentar.'
}
async function resolve(query) {
  const { data, error } = await query.abortSignal(AbortSignal.timeout(15000))
  if (error) throw new Error(publicError(error))
  return data
}
const rpc = (name, params) => resolve(getSupabase().rpc(name, params))
export const listBusinesses = () => rpc('turnia_locales')
export const listServices = (id) => rpc('turnia_servicios', { p_barbero_id: id })
export const listOccupied = (id, date) => rpc('turnia_ocupados', { p_barbero_id: id, p_fecha: date })
export const requestBooking = (data) => rpc('turnia_solicitar', data)
export const changeStatus = (id, status) => rpc('turnia_estado', { p_id: id, p_estado: status })
export const listAppointments = (owner, date) => resolve(getSupabase().from('turnos')
  .select('*, servicios(nombre)').eq('barbero_id', owner).eq('fecha', date).order('hora'))
export const findAppointment = (owner, id) => resolve(getSupabase().from('turnos')
  .select('*, servicios(nombre)').eq('barbero_id', owner).eq('id', id).maybeSingle())
export function normalizeAppointment(row) {
  return { id: row.id, barberId: row.barbero_id, date: row.fecha, time: row.hora.slice(0, 5),
    client: row.cliente_nombre, phone: row.cliente_telefono, service: row.servicios?.nombre ?? 'Servicio',
    status: row.estado, vip: row.vip, price: Number(row.precio_total) }
}
