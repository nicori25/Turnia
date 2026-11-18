import { createContext, useContext, useRef, useState } from 'react'
import { localDate, sampleBookings, services, slotAvailable, validCustomer, vipSurcharge } from './booking'

const Demo = createContext(null)
const initialDraft = { serviceId: '', date: '', time: '', vip: false }

export function DemoProvider({ children }) {
  const [draft, setDraft] = useState(initialDraft)
  const [bookings, setBookings] = useState(sampleBookings)
  const [receipt, setReceipt] = useState(null)
  const [admin, setAdmin] = useState(false)
  const latestBookings = useRef(bookings)
  const bookingSequence = useRef(0)

  function saveBookings(next) {
    latestBookings.current = next
    setBookings(next)
  }

  function startBooking(serviceId = '') {
    setDraft({ ...initialDraft, serviceId, date: localDate() })
    setReceipt(null)
  }

  function updateDraft(changes) {
    setDraft((previous) => ({ ...previous, ...changes }))
  }

  function reserve(name, phone) {
    const service = services.find(({ id }) => id === draft.serviceId)
    if (!service || !validCustomer(name, phone)) return 'Revisá el servicio, el nombre y el teléfono.'
    if (!slotAvailable(latestBookings.current, draft.date, draft.time, service.duration)) {
      return 'El horario ya no está disponible. Elegí otro para continuar.'
    }
    bookingSequence.current += 1
    const booking = {
      ...draft,
      id: 'turnia-' + bookingSequence.current,
      service: service.name,
      duration: service.duration,
      name: name.trim(),
      phone: phone.trim(),
      price: service.price + (draft.vip ? vipSurcharge : 0),
      status: 'pendiente',
    }
    saveBookings([...latestBookings.current, booking])
    setReceipt(booking)
    return ''
  }

  function setStatus(id, status) {
    saveBookings(latestBookings.current.map((booking) => (
      booking.id === id && booking.status !== 'cancelado' ? { ...booking, status } : booking
    )))
  }

  return (
    <Demo.Provider value={{ draft, startBooking, updateDraft, bookings, reserve, receipt, admin, setAdmin, setStatus }}>
      {children}
    </Demo.Provider>
  )
}

export const useDemo = () => useContext(Demo)
