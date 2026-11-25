import { supabase } from '../lib/supabase'
import { businessDate, isFutureBusinessSlot, timeSlots, vipSurcharge } from './booking'

const missingRPC = (error) => ['PGRST202', '42883'].includes(error?.code)
async function rpc(name, params, signal) {
  const query = supabase.rpc(name, params)
  return signal ? query.abortSignal(signal) : query
}
async function checked(name, params, signal) {
  const { data, error } = await rpc(name, params, signal)
  if (error) throw error
  return data
}

export async function loadCatalog(signal) {
  const { data, error } = await rpc('catalogo_turnia', {}, signal)
  if (error && !missingRPC(error)) throw error
  if (!error) return {
    today: data.fecha_local, surcharge: Number(data.recargo_vip),
    services: data.servicios.map((item) => ({
      id: item.profesional_id + ':' + item.id, serviceId: item.id,
      professionalId: item.profesional_id, professional: item.profesional,
      business: item.organizacion, description: item.descripcion,
      name: item.nombre, duration: item.duracion_min, price: Number(item.precio),
    })),
  }
  // Compatibilidad con la base ya instalada para main. Solo se usa si falta la RPC de App.
  const professionals = await checked('turnia_v2_locales', {}, signal)
  const catalogs = await Promise.all(professionals.map(async (professional) => {
    const services = await checked('turnia_v2_servicios', { p_profesional_id: professional.id }, signal)
    return services.map((s) => ({ id: professional.id + ':' + s.id, serviceId: s.id,
      professionalId: professional.id, professional: professional.business_name, business: '',
      name: s.nombre, duration: s.duracion_min, price: Number(s.precio) }))
  }))
  return { today: businessDate(), surcharge: vipSurcharge, services: catalogs.flat() }
}

export async function loadAvailability(serviceId, professionalId, date, signal) {
  const { data, error } = await rpc('horarios_disponibles', {
    p_servicio_id: serviceId, p_profesional_id: professionalId, p_fecha: date,
  }, signal)
  if (error && !missingRPC(error)) throw error
  if (!error) return data.map((time) => time.slice(0, 5))
  const rows = await checked('turnia_v2_ocupados', {
    p_profesional_id: professionalId, p_fecha: date, p_servicio_id: serviceId,
  }, signal)
  const occupied = rows.map(({ hora }) => hora.slice(0, 5))
  return timeSlots.filter((time) => isFutureBusinessSlot(date, time) && !occupied.includes(time))
}

export async function saveReservation({ requestId, service, draft, name, phone, price }) {
  let { data, error } = await rpc('reservar_turno_app', {
    p_solicitud_id: requestId, p_servicio_id: service.serviceId, p_profesional_id: service.professionalId,
    p_fecha: draft.date, p_hora: draft.time, p_vip: draft.vip, p_cliente_nombre: name.trim(),
    p_cliente_telefono: phone.trim(), p_precio_esperado: price,
  })
  if (error && !missingRPC(error)) throw error
  if (error) {
    data = await checked('turnia_v2_solicitar', { p_solicitud_id: requestId,
      p_servicio_id: service.serviceId, p_profesional_id: service.professionalId,
      p_fecha: draft.date, p_hora: draft.time, p_vip: draft.vip, p_nombre: name.trim(), p_telefono: phone.trim() })
  }
  return { id: data.id, service: data.servicio ?? service.name, date: data.fecha,
    time: data.hora.slice(0, 5), vip: data.vip ?? draft.vip, price: Number(data.precio_total), status: data.estado }
}
