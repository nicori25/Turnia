export const services = [
  { id: 'corte', name: 'Corte', duration: 30, price: 4500, description: 'Corte a tijera o máquina, con terminación y peinado.' },
  { id: 'barba', name: 'Barba', duration: 20, price: 3000, description: 'Perfilado y arreglo de barba.' },
  { id: 'corte-barba', name: 'Corte + barba', duration: 45, price: 7000, description: 'Corte y perfilado de barba en una sola visita.' },
]

export const timeSlots = ['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']
export const vipSurcharge = 1500

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [date.getFullYear(), month, day].join('-')
}

export function upcomingDates(now = new Date()) {
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return { key: localDate(day), weekday: offset === 0 ? 'Hoy' : new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(day), day: day.getDate() }
  })
}

export function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(year, month - 1, day))
}

export function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price)
}

function minutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function slotAvailable(bookings, date, time, duration, now = new Date()) {
  const start = minutes(time)
  const today = localDate(now)
  if (!timeSlots.includes(time) || date < today || (date === today && start <= now.getHours() * 60 + now.getMinutes())) return false
  return bookings.every((booking) => {
    if (booking.date !== date || booking.status === 'cancelado') return true
    const reserved = minutes(booking.time)
    return start >= reserved + booking.duration || start + duration <= reserved
  })
}

export function sampleBookings(date = localDate()) {
  return [
    { id: 'demo-1', time: '10:00', name: 'Martín Díaz', serviceId: 'corte', vip: false, status: 'confirmado' },
    { id: 'demo-2', time: '11:00', name: 'Julieta Sosa', serviceId: 'corte-barba', vip: true, status: 'confirmado' },
    { id: 'demo-3', time: '12:30', name: 'Enzo Bravo', serviceId: 'barba', vip: false, status: 'pendiente' },
  ].map((booking) => {
    const service = services.find(({ id }) => id === booking.serviceId)
    return { ...booking, date, service: service.name, duration: service.duration, price: service.price + (booking.vip ? vipSurcharge : 0) }
  })
}

export function validCustomer(name, phone) {
  const digits = phone.replace(/\D/g, '')
  return name.trim().length >= 2 && /^[+\d ().-]+$/.test(phone) && digits.length >= 8 && digits.length <= 15
}
