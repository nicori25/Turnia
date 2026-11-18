import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.TURNIA_TEST_URL ?? 'http://127.0.0.1:54321'
const rest = process.env.TURNIA_TEST_REST_URL ?? base + '/rest/v1'
const auth = process.env.TURNIA_TEST_AUTH_URL ?? base + '/auth/v1'
const key = process.env.TURNIA_TEST_KEY

for (const endpoint of [rest, auth]) {
  assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname),
    'Ejecutá estas pruebas contra una base local descartable.')
}

async function call(url, { method = 'GET', payload, token, headers } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { apikey: key } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const content = await response.text()
  return { status: response.status, body: content ? JSON.parse(content) : null }
}

function rpc(name, payload = {}, token) {
  return call(rest + '/rpc/' + name, { method: 'POST', payload, token })
}

async function register(label) {
  const suffix = randomUUID().slice(0, 8)
  const email = `turnia-${suffix}@example.com`
  const password = randomUUID()
  const { status, body } = await call(auth + '/signup', {
    method: 'POST', payload: { email, password, data: { business_name: label } },
  })
  assert.equal(status, 200, body?.msg)
  assert(body.user?.id)
  const login = await call(auth + '/token?grant_type=password', { method: 'POST', payload: { email, password } })
  assert.equal(login.status, 200, login.body?.msg ?? 'Habilitá el registro local y desactivá la confirmación por correo para esta prueba.')
  assert(login.body.access_token)
  const token = login.body.access_token
  assert.equal((await rpc('preparar_cuenta_turnia', { p_nombre: label }, token)).body, true)
  assert.equal((await rpc('preparar_cuenta_turnia', { p_nombre: 'Otro nombre' }, token)).body, true)
  return { id: body.user.id, token }
}

function saveService(barber, values) {
  return rpc('guardar_servicio_turnia', {
    p_id: null, p_nombre: null, p_duracion_min: null, p_precio: null, p_activo: null, ...values,
  }, barber.token)
}

async function service(barber, name, duration, price) {
  const { status, body } = await saveService(barber, { p_nombre: name, p_duracion_min: duration, p_precio: price })
  assert.equal(status, 200, body?.message)
  assert.equal(typeof body, 'string')
  return body
}

function changeStatus(turnId, barber, estado) {
  return rpc('cambiar_estado_turnia', { p_turno_id: turnId, p_estado: estado }, barber.token)
}

function agenda(turnId, barber) {
  return rpc('mi_agenda_turnia', { p_turno_id: turnId, p_fecha: null }, barber?.token)
}

const first = await register('Barbería de prueba A')
const second = await register('Barbería de prueba B')
const long = await service(first, 'Corte largo', 90, 4500.25)
const short = await service(first, 'Barba', 20, 3000)
const other = await service(second, 'Corte alternativo', 30, 3600)

const catalog = await rpc('catalogo_turnia')
assert.equal(catalog.status, 200)
assert.equal(catalog.body.recargo_vip, 1500)
const firstOffering = catalog.body.servicios.find(({ id }) => id === long)
const secondOffering = catalog.body.servicios.find(({ id }) => id === other)
assert.equal(firstOffering.organizacion, 'Barbería de prueba A')
assert.notEqual(firstOffering.organizacion_id, secondOffering.organizacion_id)
assert.deepEqual(Object.keys(firstOffering).sort(),
  ['descripcion', 'duracion_min', 'id', 'nombre', 'organizacion', 'organizacion_id', 'precio', 'profesional', 'profesional_id'])

const tomorrow = new Date(catalog.body.fecha_local + 'T12:00:00Z')
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
const date = tomorrow.toISOString().slice(0, 10)
const availability = (id = long, day = date, professional = firstOffering.profesional_id) =>
  rpc('horarios_disponibles', { p_servicio_id: id, p_profesional_id: professional, p_fecha: day })

const free = await availability()
assert.equal(free.status, 200, free.body?.message)
assert(free.body.includes('10:00:00'))
assert.deepEqual((await availability(long, '2000-01-01')).body, [])

const book = (payload) => rpc('reservar_turno', payload)
const booking = {
  p_solicitud_id: randomUUID(),
  p_servicio_id: long,
  p_profesional_id: firstOffering.profesional_id,
  p_fecha: date,
  p_hora: '10:00',
  p_vip: true,
  p_cliente_nombre: 'Cliente ficticio',
  p_cliente_telefono: '11 1234 5678',
  p_precio_esperado: 6000.25,
}

assert.equal((await book({ ...booking, p_precio_esperado: 1 })).body.message, 'PRECIO_CAMBIO')
assert.equal((await book({ ...booking, p_cliente_telefono: 'texto' })).body.message, 'DATOS_INVALIDOS')
assert.equal((await book({ ...booking, p_hora: '10:15' })).body.message, 'HORARIO_NO_DISPONIBLE')
assert.equal((await book({ ...booking, p_fecha: '2099-01-01' })).body.message, 'HORARIO_NO_DISPONIBLE')
assert.deepEqual((await availability(long, date, secondOffering.profesional_id)).body, [])
assert.equal((await book({ ...booking, p_profesional_id: secondOffering.profesional_id })).body.message, 'SERVICIO_NO_DISPONIBLE')

const overlapping = {
  ...booking, p_solicitud_id: randomUUID(), p_servicio_id: short,
  p_hora: '11:00', p_vip: false, p_precio_esperado: 3000,
}
const race = await Promise.all([book(booking), book(overlapping)])
assert.equal(race.filter(({ status }) => status === 200).length, 1)
const success = race.find(({ status }) => status === 200).body
const winningRequest = race[0].status === 200 ? booking : overlapping
assert.equal(race.find(({ status }) => status !== 200).body.message, 'HORARIO_NO_DISPONIBLE')
assert.equal(success.precio_total, winningRequest.p_precio_esperado)
assert(!('cliente_telefono' in success))
assert.equal(success.estado, 'pendiente')
assert(!((await availability(long)).body.includes('10:00:00')))

const retry = await Promise.all([book(winningRequest), book(winningRequest)])
assert.deepEqual(retry.map(({ body }) => body.id), [success.id, success.id])
assert.equal((await book({ ...winningRequest, p_cliente_nombre: 'Otro cliente ficticio' })).body.message, 'SOLICITUD_INVALIDA')
const ownRow = await agenda(success.id, first)
assert.equal(ownRow.body[0].cliente_nombre, 'Cliente ficticio')
assert([401, 403, 404].includes((await agenda(success.id)).status))
assert.deepEqual((await agenda(success.id, second)).body, [])
assert.equal((await changeStatus(success.id, second, 'cancelado')).body, false)
assert.equal((await changeStatus(success.id, first, 'confirmado')).body, true)
assert.equal((await changeStatus(success.id, first, 'cancelado')).body, true)
assert.equal((await agenda(success.id, first)).body[0].estado, 'cancelado')
assert.equal((await changeStatus(success.id, first, 'confirmado')).body, false)
assert((await availability(long)).body.includes('10:00:00'))

const otherBarber = await book({
  ...booking, p_solicitud_id: randomUUID(), p_servicio_id: other, p_profesional_id: secondOffering.profesional_id, p_vip: false, p_precio_esperado: 3600,
})
assert.equal(otherBarber.status, 200)
const newRequest = { ...booking, p_solicitud_id: randomUUID() }
const newReservation = await book(newRequest)
assert.equal(newReservation.status, 200)
assert.equal((await saveService(second, { p_id: long, p_activo: false })).body, null)
const edit = await saveService(first, { p_id: long, p_nombre: 'Corte ajustado', p_duracion_min: 10, p_precio: 7800 })
assert.equal(edit.body, long)
assert(!((await availability(short)).body.includes('11:00:00')))
assert.equal((await book(newRequest)).body.precio_total, 6000.25)

const pause = await saveService(first, { p_id: long, p_activo: false })
assert.equal(pause.body, long)
assert.equal((await rpc('mis_servicios_turnia', {}, first.token)).body.find(({ id }) => id === long).activo, false)
assert(!((await rpc('catalogo_turnia')).body.servicios.some(({ id }) => id === long)))
assert.deepEqual((await availability(long)).body, [])
assert.equal((await book({ ...booking, p_solicitud_id: randomUUID(), p_hora: '16:00' })).body.message, 'SERVICIO_NO_DISPONIBLE')

console.log('Reservas verificadas mediante Auth y PostgREST: concurrencia, precio, reintentos, permisos, cancelaciones y catálogo.')
