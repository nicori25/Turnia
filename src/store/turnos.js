import { reactive, watch } from 'vue'
import { isFutureSlot } from '../utils/dates.js'
import { changeStatus, findAppointment, listAppointments, listOccupied, normalizeAppointment } from '../services/turnia.js'
import { authState } from './auth.js'

export const timeSlots = ['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']
export const turnos = reactive([])
export const availability = reactive({ barberId: null, date: '', ready: false, loading: false, error: '', slots: [] })
let availabilityRequest = 0
let agendaRequest = 0

export function clearAvailability() {
  availabilityRequest++
  Object.assign(availability, { barberId: null, date: '', ready: false, loading: false, error: '', slots: [] })
}
export async function refreshAvailability(barberId, date) {
  const request = ++availabilityRequest
  const same = availability.barberId === barberId && availability.date === date
  Object.assign(availability, { barberId, date, loading: true, error: '' })
  if (!same) Object.assign(availability, { ready: false, slots: [] })
  try {
    const rows = await listOccupied(barberId, date)
    if (request !== availabilityRequest) return
    availability.slots = rows.map((row) => row.hora.slice(0, 5))
    availability.ready = true
  } catch (e) {
    if (request === availabilityRequest) { availability.error = e.message; availability.ready = false }
  } finally {
    if (request === availabilityRequest) availability.loading = false
  }
}
export function isConfirmedSlot(date, time) {
  return availability.date === date && availability.slots.includes(time)
}
export function isSlotAvailable(date, time, now = new Date()) {
  return availability.ready && !availability.error && availability.date === date &&
    timeSlots.includes(time) && isFutureSlot(date, time, now) && !isConfirmedSlot(date, time)
}
export function getTurno(id) { return turnos.find((t) => t.id === id) }
export async function loadAgenda(date) {
  const request = ++agendaRequest
  const owner = authState.user?.id
  if (!owner) throw new Error('Iniciá sesión para ver la agenda.')
  const rows = await listAppointments(owner, date)
  if (request !== agendaRequest || authState.user?.id !== owner) return
  turnos.splice(0, turnos.length, ...rows.map(normalizeAppointment))
}
export async function loadTurno(id) {
  const owner = authState.user?.id
  if (!owner) throw new Error('Iniciá sesión para ver el turno.')
  const row = await findAppointment(owner, id)
  if (authState.user?.id !== owner) throw new Error('La sesión cambió. Volvé a iniciar sesión.')
  return row ? normalizeAppointment(row) : null
}
export async function setEstado(id, status) {
  if (!['confirmado', 'cancelado'].includes(status)) throw new Error('Estado inválido.')
  const owner = authState.user?.id
  if (!owner) throw new Error('Iniciá sesión para modificar el turno.')
  const result = await changeStatus(id, status)
  if (authState.user?.id !== owner) return
  const turno = getTurno(id)
  if (turno) turno.status = result.estado
  return result
}
watch(() => authState.user?.id, () => {
  agendaRequest++
  turnos.splice(0)
})
