import { randomUUID } from 'expo-crypto'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './auth'
import { localDate, sampleBookings, services, slotAvailable, validCustomer, vipSurcharge } from './booking'
import { loadCatalog, saveReservation } from './reservations'

const Turnia = createContext(null)
const initialDraft = { professionalId: '', serviceId: '', date: '', time: '', vip: false }
const demoCatalog = {
  services: services.map((service) => ({ ...service, professionalId: 'demo', business: 'Martín Barber Studio' })),
  surcharge: vipSurcharge,
}
const live = !!supabase

const messages = {
  DATOS_INVALIDOS: 'Revisá el nombre y el teléfono.',
  HORARIO_NO_DISPONIBLE: 'El horario ya no está disponible. Volvé a los horarios y elegí otro.',
  PRECIO_CAMBIO: 'El precio cambió. Volvé a seleccionar el servicio para revisar el total.',
  SERVICIO_NO_DISPONIBLE: 'El servicio ya no está disponible. Volvé para elegir otro.',
}

export function TurniaProvider({ children }) {
  const [draft, setDraft] = useState(initialDraft)
  const [bookings, setBookings] = useState(sampleBookings)
  const [receipt, setReceipt] = useState(null)
  const [admin, setAdmin] = useState(false)
  const [catalog, setCatalog] = useState(live ? null : demoCatalog)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogVersion, setCatalogVersion] = useState(0)
  const latestBookings = useRef(bookings)
  const bookingSequence = useRef(0)
  const request = useRef(null)

  useEffect(() => {
    if (!live) return
    const controller = new AbortController()
    loadCatalog(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setCatalog(data) },
      () => { if (!controller.signal.aborted) setCatalogError(true) },
    )
    return () => controller.abort()
  }, [catalogVersion])

  function reloadCatalog() {
    if (!live) return
    setCatalogError(false)
    setCatalogVersion((version) => version + 1)
  }

  function saveBookings(next) {
    latestBookings.current = next
    setBookings(next)
  }

  function startBooking(service) {
    request.current = null
    setDraft({
      ...initialDraft,
      professionalId: service?.professionalId ?? '',
      serviceId: service?.id ?? '',
      date: catalog?.today ?? localDate(),
    })
    setReceipt(null)
    reloadCatalog()
  }

  function updateDraft(changes) {
    setDraft((previous) => ({ ...previous, ...changes }))
  }

  async function reserve(name, phone) {
    const service = catalog?.services.find(({ id }) => id === draft.serviceId)
    if (!service || !validCustomer(name, phone)) return 'Revisá el servicio, el nombre y el teléfono.'
    const surcharge = draft.vip ? catalog.surcharge : 0
    const price = (Math.round(service.price * 100) + Math.round(surcharge * 100)) / 100
    if (live) {
      const signature = JSON.stringify([draft.serviceId, draft.date, draft.time, draft.vip, name.trim(), phone.trim(), price])
      if (request.current?.signature !== signature) request.current = { signature, id: randomUUID() }
      const currentRequest = request.current
      try {
        const booking = await saveReservation({ requestId: currentRequest.id, service, draft, name, phone, price })
        if (request.current === currentRequest) setReceipt({ ...booking, name: name.trim(), professional: service.professional, business: service.business, surcharge })
        return ''
      } catch (error) {
        if (error.message === 'PRECIO_CAMBIO' || error.message === 'SERVICIO_NO_DISPONIBLE') reloadCatalog()
        return messages[error.message] ?? 'No pudimos confirmar la solicitud. Reintentá con los mismos datos para comprobar si se guardó.'
      }
    }

    if (!slotAvailable(latestBookings.current, draft.date, draft.time, service.duration)) return messages.HORARIO_NO_DISPONIBLE
    bookingSequence.current += 1
    const booking = {
      ...draft,
      id: 'turnia-' + bookingSequence.current,
      service: service.name,
      duration: service.duration,
      name: name.trim(),
      phone: phone.trim(),
      price,
      surcharge,
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
    <Turnia.Provider value={{
      live, catalog, catalogError, reloadCatalog, draft, startBooking, updateDraft,
      bookings, reserve, receipt, admin, setAdmin, setStatus,
    }}>
      {children}
    </Turnia.Provider>
  )
}

export const useTurnia = () => useContext(Turnia)
