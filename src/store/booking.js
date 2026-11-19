import { reactive } from 'vue'
import { createTurno, getTurno, isSlotAvailable } from './turnos.js'
export { timeSlots } from './turnos.js'

export const services = [
  { id: 'corte', name: 'Corte', duration: '30 min', price: 4500 },
  { id: 'barba', name: 'Barba', duration: '20 min', price: 3000 },
  { id: 'corte-barba', name: 'Corte + barba', duration: '45 min', price: 7000 },
]

// Reserving a VIP slot skips the wait list — this is the "priority" pricing
// lever from the monetization doc: a surcharge on top of the service price.
export const VIP_SURCHARGE = 1500

export const booking = reactive({
  serviceId: null,
  date: '',
  time: null,
  turnoId: null,
  vip: false,
  name: '',
  phone: '',
})

export function resetBooking() {
  booking.serviceId = null
  booking.date = ''
  booking.time = null
  booking.turnoId = null
  booking.vip = false
  booking.name = ''
  booking.phone = ''
}

export function selectedService() {
  return services.find((s) => s.id === booking.serviceId) || null
}

export function totalPrice() {
  const service = selectedService()
  if (!service) return 0
  return service.price + (booking.vip ? VIP_SURCHARGE : 0)
}

export function submitBooking(now = new Date()) {
  if (booking.turnoId) return getTurno(booking.turnoId)
  const service = selectedService()
  if (!service || !isSlotAvailable(booking.date, booking.time, now)) {
    throw new Error('La fecha o el horario ya no están disponibles. Volvé a elegir el turno.')
  }
  if (booking.name.trim().length < 2 || booking.phone.trim().length < 6) {
    throw new Error('Completá tu nombre y teléfono para solicitar el turno.')
  }
  const turno = createTurno({
    date: booking.date, time: booking.time, client: booking.name.trim(),
    phone: booking.phone.trim(), service: service.name, vip: booking.vip, price: totalPrice(),
  }, now)
  booking.turnoId = turno.id
  return turno
}
