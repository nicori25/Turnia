import { supabase } from './auth'

export async function loadCatalog(signal) {
  const { data, error } = await supabase.rpc('catalogo_turnia').abortSignal(signal)
  if (error) throw error
  return {
    today: data.fecha_local,
    surcharge: Number(data.recargo_vip),
    services: data.servicios.map((item) => ({
      id: item.id,
      barberId: item.barbero_id,
      business: item.barberia,
      name: item.nombre,
      duration: item.duracion_min,
      price: Number(item.precio),
    })),
  }
}

export async function loadAvailability(serviceId, date, signal) {
  const { data, error } = await supabase.rpc('horarios_disponibles', {
    p_servicio_id: serviceId,
    p_fecha: date,
  }).abortSignal(signal)
  if (error) throw error
  return data.map((time) => time.slice(0, 5))
}

export async function saveReservation({ requestId, draft, name, phone, price }) {
  const { data, error } = await supabase.rpc('reservar_turno', {
    p_solicitud_id: requestId,
    p_servicio_id: draft.serviceId,
    p_fecha: draft.date,
    p_hora: draft.time,
    p_vip: draft.vip,
    p_cliente_nombre: name.trim(),
    p_cliente_telefono: phone.trim(),
    p_precio_esperado: price,
  })
  if (error) throw error
  return {
    id: data.id,
    service: data.servicio,
    date: data.fecha,
    time: data.hora.slice(0, 5),
    vip: data.vip,
    price: Number(data.precio_total),
    status: data.estado,
  }
}
