import { reactive } from 'vue'

// Mock agenda for today — in the real system this list comes from Supabase
// and updates in real time as clients book through the public flow.
export const turnos = reactive([
  { id: 1, time: '10:00', client: 'Martín Díaz', service: 'Corte', vip: false, status: 'confirmado' },
  { id: 2, time: '11:00', client: 'Julieta Sosa', service: 'Corte + barba', vip: true, status: 'confirmado' },
  { id: 3, time: '12:30', client: 'Enzo Bravo', service: 'Barba', vip: false, status: 'pendiente' },
  { id: 4, time: '16:00', client: 'Camila Ruiz', service: 'Corte', vip: true, status: 'confirmado' },
  { id: 5, time: '17:30', client: 'Tomás Medina', service: 'Corte', vip: false, status: 'pendiente' },
])

export function getTurno(id) {
  return turnos.find((t) => t.id === Number(id))
}

export function setEstado(id, status) {
  const turno = getTurno(id)
  if (turno) turno.status = status
}
