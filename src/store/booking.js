import { reactive } from 'vue'

export const services = [
  { id: 'corte', name: 'Corte', duration: '30 min', price: 4500 },
  { id: 'barba', name: 'Barba', duration: '20 min', price: 3000 },
  { id: 'corte-barba', name: 'Corte + barba', duration: '45 min', price: 7000 },
]

export const timeSlots = ['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']

// Reserving a VIP slot skips the wait list — this is the "priority" pricing
// lever from the monetization doc: a surcharge on top of the service price.
export const VIP_SURCHARGE = 1500

export const booking = reactive({
  serviceId: null,
  time: null,
  vip: false,
  name: '',
  phone: '',
})

export function resetBooking() {
  booking.serviceId = null
  booking.time = null
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
