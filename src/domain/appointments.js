import { supabase } from './auth'

export const appointmentStates = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

export function isAppointmentId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function isAgendaDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validAppointmentCustomer(name, phone) {
  const length = Array.from(name.trim()).length
  const number = phone.trim()
  const digits = number.replace(/\D/g, '').length
  return length >= 2 && length <= 100 && number.length <= 30
    && /^[+()0-9 .-]+$/.test(number) && digits >= 6 && digits <= 20
}

function appointmentError(error) {
  if (error.code === '23P01' || error.message === 'Horario ocupado') {
    return 'Ese horario está ocupado. Elegí otro.'
  }
  if (error.code === '42501') return 'Tu cuenta no tiene permiso para esta operación o el turno ya no está disponible.'
  if (['PGRST202', '42883'].includes(error.code)) return 'La base todavía no tiene habilitada esta función de Turnia.'
  if ([
    'Fecha u horario pasado', 'Horario inválido', 'Nombre inválido', 'Teléfono inválido',
    'Estado inválido', 'El turno está cancelado', 'Servicio no disponible para este profesional',
    'Identificador de solicitud ya utilizado',
    'Falta el nombre del local en esta cuenta. Consultá al administrador.',
    'Tu cuenta profesional todavía no está vinculada. Consultá al administrador del local.',
    'La cuenta tiene una vinculación de organización inconsistente. Consultá al administrador.',
  ].includes(error.message)) return error.message
  return 'No pudimos completar la operación. Revisá tu conexión e intentá nuevamente.'
}

async function rpc(name, params, signal) {
  const query = supabase.rpc(name, params)
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw new Error(appointmentError(error))
  return data
}

export const prepareAccount = () => rpc('turnia_v2_preparar_cuenta')
export const loadAppointmentOptions = (signal) => rpc('turnia_v2_opciones_turno', {}, signal)
export const updateAppointmentStatus = (id, status) => rpc('turnia_v2_estado', { p_id: id, p_estado: status })
export const deleteAppointment = (id) => rpc('turnia_v2_eliminar_turno', { p_id: id })

export async function loadAppointment(id, signal) {
  const rows = await rpc('turnia_v2_agenda', { p_fecha: null, p_id: id }, signal)
  const row = rows[0]
  if (!row) return null
  return {
    professionalId: row.profesional_id, serviceId: row.servicio_id,
    date: row.fecha, time: row.hora.slice(0, 5), name: row.cliente_nombre,
    phone: row.cliente_telefono, vip: row.vip, status: row.estado,
  }
}

export function saveAppointment(id, draft, requestId) {
  return rpc('turnia_v2_guardar_turno', {
    p_id: id, p_profesional_id: draft.professionalId, p_servicio_id: draft.serviceId,
    p_fecha: draft.date, p_hora: draft.time, p_nombre: draft.name.trim(),
    p_telefono: draft.phone.trim(), p_vip: draft.vip, p_estado: draft.status,
    p_solicitud_id: requestId,
  })
}

export const agendaRoute = (date) => ({ pathname: '/admin/panel', params: date ? { date } : {} })
