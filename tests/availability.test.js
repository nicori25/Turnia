import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, isBookableDate, isFutureSlot, isValidDate, formatDate } from '../src/utils/dates.js'
import { createTurno, getTurno, isSlotAvailable, setEstado, turnos } from '../src/store/turnos.js'
import { booking, resetBooking, submitBooking } from '../src/store/booking.js'

const now = new Date('2030-06-15T12:00:00Z') // 09:00 in Buenos Aires
const saved = turnos.map((t) => ({ ...t }))
beforeEach(() => { turnos.splice(0); resetBooking() })
afterEach(() => { turnos.splice(0, turnos.length, ...saved.map((t) => ({ ...t }))); resetBooking() })
const request = (overrides = {}) => ({ date: '2030-06-15', time: '10:00', client: 'Prueba', service: 'Corte', ...overrides })

test('business date uses Buenos Aires, including UTC midnight', () => {
  assert.equal(businessDate(new Date('2030-06-15T02:30:00Z')), '2030-06-14')
  assert.equal(businessDate(now), '2030-06-15')
  assert.equal(formatDate('2030-06-15'), '15/06/2030')
})
test('rejects malformed dates, nonexistent days and previous dates', () => {
  for (const date of ['', null, '2030-02-30', '2030-13-01', '15/06/2030']) assert.equal(isValidDate(date), false)
  assert.equal(isBookableDate('2030-06-14', now), false)
  assert.equal(isBookableDate('2030-06-15', now), true)
  assert.equal(isBookableDate('2030-06-16', now), true)
})
test('today excludes past and current minute, but permits future slots', () => {
  const ten = new Date('2030-06-15T13:00:00Z')
  assert.equal(isFutureSlot('2030-06-15', '09:59', ten), false)
  assert.equal(isFutureSlot('2030-06-15', '10:00', ten), false)
  assert.equal(isFutureSlot('2030-06-15', '11:00', ten), true)
  assert.equal(isFutureSlot('2030-06-16', '10:00', ten), true)
  assert.equal(isSlotAvailable('2030-06-15', '10:15', now), false)
})
test('pending request enters the agenda; acceptance blocks only its date and time', () => {
  const turno = createTurno(request(), now)
  assert.equal(turno.status, 'pendiente')
  assert.equal(isSlotAvailable(turno.date, turno.time, now), true)
  setEstado(turno.id, 'confirmado', now)
  assert.equal(getTurno(turno.id).status, 'confirmado')
  assert.equal(isSlotAvailable('2030-06-15', '10:00', now), false)
  assert.equal(isSlotAvailable('2030-06-16', '10:00', now), true)
  assert.equal(isSlotAvailable('2030-06-15', '11:00', now), true)
})
test('cannot accept two pending requests for the same slot', () => {
  const a = createTurno(request(), now), b = createTurno(request(), now)
  setEstado(a.id, 'confirmado', now)
  assert.throws(() => setEstado(b.id, 'confirmado', now), /ocupado/)
  assert.equal(getTurno(b.id).status, 'pendiente')
  assert.throws(() => createTurno(request(), now), /disponible/)
})
test('cancellation frees a future slot and has an explicit cancelled state', () => {
  const turno = createTurno(request(), now)
  setEstado(turno.id, 'confirmado', now)
  setEstado(turno.id, 'cancelado', now)
  assert.equal(getTurno(turno.id).status, 'cancelado')
  assert.equal(isSlotAvailable(turno.date, turno.time, now), true)
})
test('creation and acceptance revalidate time even if UI was left open', () => {
  const turno = createTurno(request(), now)
  const late = new Date('2030-06-15T13:00:00Z')
  assert.throws(() => setEstado(turno.id, 'confirmado', late), /fecha ya pasó/)
  assert.throws(() => createTurno(request(), late), /disponible/)
  assert.throws(() => createTurno(request({date: '2030-06-14'}), now), /disponible/)
})
test('submission creates one pending request and reset removes all draft date data', () => {
  Object.assign(booking, { serviceId: 'corte', date: '2030-06-15', time: '10:00', name: 'Prueba', phone: '1112345678', vip: true })
  const turno = submitBooking(now)
  assert.equal(submitBooking(now).id, turno.id)
  assert.equal(turnos.length, 1)
  assert.equal(turno.price, 6000)
  assert.equal(turno.date, booking.date)
  resetBooking()
  assert.equal(booking.date, '')
  assert.equal(booking.time, null)
  assert.equal(booking.turnoId, null)
})
test('submission rejects a slot accepted since the selection step', () => {
  Object.assign(booking, { serviceId: 'corte', date: '2030-06-15', time: '10:00', name: 'Prueba', phone: '1112345678' })
  const other = createTurno(request(), now)
  setEstado(other.id, 'confirmado', now)
  assert.throws(() => submitBooking(now), /disponibles/)
  assert.equal(turnos.length, 1)
})
