import { reactive } from 'vue'
import { clearAvailability, isSlotAvailable, refreshAvailability } from './turnos.js'
import { listBusinesses, listServices, requestBooking } from '../services/turnia.js'
export { timeSlots } from './turnos.js'

export const services = reactive([])
export const businesses = reactive([])
export const catalog = reactive({ loading: false, error: '', loaded: false })
export const VIP_SURCHARGE = 1500
export const booking = reactive({ barberId: null, serviceId: null, date: '', time: null,
  turnoId: null, requestId: null, receipt: null, vip: false, name: '', phone: '' })
let catalogRequest = 0
export function resetBooking() {
  Object.assign(booking, { barberId: null, serviceId: null, date: '', time: null,
    turnoId: null, requestId: null, receipt: null, vip: false, name: '', phone: '' })
  services.splice(0)
  clearAvailability()
}
export async function loadBusinesses() {
  catalog.loading = true; catalog.error = ''; catalog.loaded = false
  try {
    const rows = await listBusinesses()
    businesses.splice(0, businesses.length, ...rows)
    catalog.loaded = true
    if (rows.length === 1) await selectBusiness(rows[0].id)
    else if (booking.barberId && !rows.some((b) => b.id === booking.barberId)) await selectBusiness(null)
  } catch (e) { catalog.error = e.message }
  finally { catalog.loading = false }
}
export async function selectBusiness(id) {
  const request = ++catalogRequest
  booking.barberId = id || null; booking.serviceId = null; booking.time = null
  clearAvailability(); services.splice(0)
  if (!id) return
  catalog.loading = true; catalog.error = ''
  try {
    const rows = await listServices(id)
    if (request !== catalogRequest) return
    services.splice(0, services.length, ...rows.map((s) => ({ id: s.id, name: s.nombre, duration: `${s.duracion_min} min`, price: Number(s.precio) })))
    if (booking.date) await refreshAvailability(id, booking.date)
  } catch (e) { if (request === catalogRequest) catalog.error = e.message }
  finally { if (request === catalogRequest) catalog.loading = false }
}
export function selectedService() { return services.find((s) => s.id === booking.serviceId) || null }
export function totalPrice() { const s = selectedService(); return s ? s.price + (booking.vip ? VIP_SURCHARGE : 0) : 0 }
export function validPhone(value) { return /^[+()\d .-]+$/.test(value) && value.replace(/\D/g, '').length >= 6 && value.replace(/\D/g, '').length <= 20 && value.length <= 30 }
let submitting = false
let requestFingerprint = null
export async function submitBooking(now = new Date()) {
  if (booking.receipt) return booking.receipt
  if (submitting) throw new Error('La solicitud ya se está enviando.')
  const service = selectedService()
  if (!service || !booking.barberId || !isSlotAvailable(booking.date, booking.time, now)) throw new Error('La fecha o el horario ya no están disponibles.')
  if (booking.name.trim().length < 2 || booking.name.trim().length > 100 || !validPhone(booking.phone.trim())) throw new Error('Completá un nombre y teléfono válidos.')
  const fingerprint = JSON.stringify([service.id, booking.date, booking.time, booking.name.trim(), booking.phone.trim(), booking.vip])
  if (!booking.requestId || requestFingerprint !== fingerprint) booking.requestId = crypto.randomUUID()
  requestFingerprint = fingerprint
  submitting = true
  try {
    const result = await requestBooking({ p_servicio_id: service.id, p_fecha: booking.date, p_hora: booking.time,
      p_nombre: booking.name.trim(), p_telefono: booking.phone.trim(), p_vip: booking.vip, p_solicitud_id: booking.requestId })
    booking.turnoId = result.id; booking.receipt = result
    return result
  } catch (e) {
    await refreshAvailability(booking.barberId, booking.date)
    throw e
  } finally { submitting = false }
}
