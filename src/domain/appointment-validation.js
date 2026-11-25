import { isFutureBusinessSlot, timeSlots } from './booking.js'

export function isAgendaDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validAppointmentCustomer(name, phone) {
  const length = Array.from(name.trim()).length
  const number = phone.trim(), digits = number.replace(/\D/g, '').length
  return length >= 2 && length <= 100 && number.length <= 30
    && /^[+()0-9 .-]+$/.test(number) && digits >= 6 && digits <= 20
}

export function appointmentFormError(form, professionals, services, initial, now = new Date()) {
  if (!professionals.some(({ id }) => id === form.professionalId)) return 'Elegí un profesional activo.'
  if (!services.some(({ id }) => id === form.serviceId)) return 'Elegí un servicio disponible para ese profesional.'
  if (!isAgendaDate(form.date)) return 'Completá una fecha válida con formato AAAA-MM-DD.'
  if (!timeSlots.includes(form.time)) return 'Elegí un horario de la lista.'
  const historicalUnchanged = initial && ['date', 'time', 'professionalId', 'serviceId', 'status']
    .every((key) => initial[key] === form[key])
  if (!historicalUnchanged && !isFutureBusinessSlot(form.date, form.time, now)) {
    return 'Para cambiar el servicio, profesional, estado o fecha de un turno pasado, elegí una fecha y hora futuras. Podés corregir nombre y teléfono manteniendo los demás datos originales.'
  }
  const nameLength = Array.from(form.name.trim()).length
  if (nameLength < 2 || nameLength > 100) return 'El nombre debe tener entre 2 y 100 caracteres.'
  if (!validAppointmentCustomer(form.name, form.phone)) return 'Ingresá un teléfono con entre 6 y 20 dígitos. Se permiten espacios, +, paréntesis y guiones.'
  return ''
}
