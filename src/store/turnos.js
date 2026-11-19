import { reactive } from 'vue'
import { businessDate, isFutureSlot } from '../utils/dates.js'

export const timeSlots = ['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']
const today = businessDate()

// Demo agenda shared by the client and barber in this browser session.
// Production needs server-side availability and atomic reservations.
export const turnos = reactive([
  { id: 1, date: today, time: '10:00', client: 'Martín Díaz', service: 'Corte', vip: false, status: 'confirmado' },
  { id: 2, date: today, time: '11:00', client: 'Julieta Sosa', service: 'Corte + barba', vip: true, status: 'confirmado' },
  { id: 3, date: today, time: '12:30', client: 'Enzo Bravo', service: 'Barba', vip: false, status: 'pendiente' },
  { id: 4, date: today, time: '16:00', client: 'Camila Ruiz', service: 'Corte', vip: true, status: 'confirmado' },
  { id: 5, date: today, time: '17:30', client: 'Tomás Medina', service: 'Corte', vip: false, status: 'pendiente' },
])

export function getTurno(id) {
  return turnos.find((t) => t.id === Number(id))
}

export function isConfirmedSlot(date, time, excludeId = null) {
  return turnos.some((t) => t.id !== excludeId && t.date === date && t.time === time && t.status === 'confirmado')
}

export function isSlotAvailable(date, time, now = new Date(), excludeId = null) {
  return timeSlots.includes(time) && isFutureSlot(date, time, now) && !isConfirmedSlot(date, time, excludeId)
}

export function createTurno(data, now = new Date()) {
  if (!isSlotAvailable(data.date, data.time, now)) {
    throw new Error('Ese horario ya no está disponible. Elegí otra fecha u horario.')
  }
  const turno = { ...data, id: Math.max(0, ...turnos.map((t) => t.id)) + 1, status: 'pendiente' }
  turnos.push(turno)
  return turno
}

export function setEstado(id, status, now = new Date()) {
  const turno = getTurno(id)
  if (!turno) throw new Error('No encontramos ese turno.')
  if (!['confirmado', 'cancelado'].includes(status)) throw new Error('Estado de turno inválido.')
  if (status === 'confirmado' && !isSlotAvailable(turno.date, turno.time, now, turno.id)) {
    throw new Error('No se puede confirmar: la fecha ya pasó o el horario está ocupado por otro turno confirmado.')
  }
  turno.status = status
}
