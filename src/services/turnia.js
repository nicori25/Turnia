import { getSupabase } from '../lib/supabaseClient.js'

export function publicError(error) {
  const message = error?.message ?? ''
  if (/ocupado|unique|23505|exclusion|conflicting key/i.test(message) || ['23505', '23P01'].includes(error?.code)) return 'Ese horario ya está ocupado. Elegí otro horario.'
  if (/pasado/i.test(message)) return 'La fecha o el horario ya pasaron. Elegí otro turno.'
  if (/Teléfono inválido|Nombre inválido|Estado inválido|ya utilizado/i.test(message)) return message
  if (/Servicio no disponible|Horario inválido/.test(message)) return message
  if (/nombre del local|todavía no está vinculada|vinculación de organización/i.test(message)) return message
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
export const prepareAccount = () => rpc('turnia_v2_preparar_cuenta')
export const listBusinesses = () => rpc('turnia_v2_locales')
export const listServices = (id) => rpc('turnia_v2_servicios', { p_profesional_id: id })
export const listOccupied = (id, date, serviceId) => rpc('turnia_v2_ocupados', { p_profesional_id: id, p_fecha: date, p_servicio_id: serviceId || null })
export const requestBooking = (data) => rpc('turnia_v2_solicitar', data)
export const changeStatus = (id, status) => rpc('turnia_v2_estado', { p_id: id, p_estado: status })
export const appointmentOptions = () => rpc('turnia_v2_opciones_turno')
export const saveAppointment = (data) => rpc('turnia_v2_guardar_turno', data)
export const deleteAppointment = (id) => rpc('turnia_v2_eliminar_turno', { p_id: id })
export const listAppointments = (_owner, date) => rpc('turnia_v2_agenda', { p_fecha: date, p_id: null })
export const findAppointment = async (_owner, id) => {
  const rows = await rpc('turnia_v2_agenda', { p_fecha: null, p_id: id })
  return rows[0] ?? null
}
export function normalizeAppointment(row) {
  return { id: row.id, barberId: row.profesional_id, serviceId: row.servicio_id, date: row.fecha, time: row.hora.slice(0, 5),
    client: row.cliente_nombre, phone: row.cliente_telefono, service: row.servicio_nombre ?? row.servicios?.nombre ?? 'Servicio',
    status: row.estado, vip: row.vip, price: Number(row.precio_total) }
}
