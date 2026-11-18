import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import Check from 'lucide-react-native/icons/check'
import Sparkles from 'lucide-react-native/icons/sparkles'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { BackLink, Button, Card, colors, Heading, Message, Screen, styles } from '../src/components/ui'
import { businessDate, formatPrice, slotAvailable, timeSlots, upcomingDates } from '../src/domain/booking'
import { loadAvailability } from '../src/domain/reservations'
import { useTurnia } from '../src/domain/turnia'

function Option({ selected, disabled = false, onPress, label, children, compact = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={({ hovered }) => [booking.option, compact && booking.compact, selected && booking.selected,
        hovered && !disabled && booking.hover, disabled && booking.disabled]}>
      {children}
    </Pressable>
  )
}

export default function Reserve() {
  const { live, catalog, catalogError, reloadCatalog, draft, updateDraft, bookings } = useTurnia()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [availability, setAvailability] = useState(null)
  const [revision, setRevision] = useState(0)
  const dates = upcomingDates(live ? catalog?.today ?? businessDate() : undefined)
  const date = dates.some(({ key }) => key === draft.date) ? draft.date : dates[0].key
  const catalogServices = catalog?.services ?? []
  const professionals = Array.from(new Map(catalogServices.map((item) => [item.professionalId, item.professional + ' · ' + item.business])))
  const professionalId = professionals.some(([id]) => id === draft.professionalId) ? draft.professionalId : professionals[0]?.[0]
  const services = catalogServices.filter((item) => item.professionalId === professionalId)
  const service = services.find(({ id }) => id === draft.serviceId)
  const serviceId = service?.serviceId
  const requestKey = draft.serviceId + ':' + date + ':' + revision
  const result = availability?.key === requestKey ? availability : null
  const times = live ? result?.times ?? [] : timeSlots
  const available = (time) => live
    ? times.includes(time)
    : slotAvailable(bookings, date, time, service?.duration ?? 30)
  const canContinue = !!service && available(draft.time)
  const surcharge = catalog?.surcharge ?? 0

  useFocusEffect(useCallback(() => {
    if (!live || !serviceId) return
    const controller = new AbortController()
    setAvailability(null)
    loadAvailability(serviceId, professionalId, date, controller.signal).then(
      (times) => { if (!controller.signal.aborted) setAvailability({ key: requestKey, times }) },
      () => { if (!controller.signal.aborted) setAvailability({ key: requestKey, error: true }) },
    )
    return () => controller.abort()
  }, [date, live, professionalId, requestKey, serviceId]))

  function next() {
    if (!canContinue) return
    updateDraft({ date, professionalId })
    router.push('/confirmar')
  }

  return (
    <Screen>
      <BackLink href="/" children="Inicio" />
      <Heading label="Reserva · 1 de 3" title="Elegí tu turno" subtitle="Seleccioná un servicio, una fecha y un horario." />
      {catalogError && (
        <>
          <Message error>No pudimos cargar los servicios.</Message>
          <Button onPress={reloadCatalog} variant="outline">Reintentar</Button>
        </>
      )}
      {!catalog && !catalogError && <Message>Cargando servicios…</Message>}
      {catalog && !catalogServices.length && <Message>Todavía no hay servicios habilitados para reservar.</Message>}
      {live && professionals.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Profesional</Text>
          {professionals.map(([id, name]) => (
            <Option key={id} label={name} selected={id === professionalId}
              onPress={() => updateDraft({ professionalId: id, serviceId: '', time: '' })}>
              <Text style={booking.name}>{name}</Text>
            </Option>
          ))}
        </Card>
      )}
      {services.length > 0 && (
        <>
          <View style={[booking.columns, width >= 770 && booking.columnsWide]}>
            <Card style={booking.services}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Servicio</Text>
              {services.map((item) => (
                <Option key={item.id} label={item.name} selected={item.id === service?.id}
                  onPress={() => updateDraft({ professionalId, serviceId: item.id, time: '' })}>
                  <View style={booking.row}>
                    <View style={booking.optionText}>
                      <Text style={booking.name}>{item.name}</Text>
                      <Text style={styles.caption}>{item.duration} min</Text>
                      {item.description && <Text style={styles.caption}>{item.description}</Text>}
                    </View>
                    <Text style={booking.price}>{formatPrice(item.price)}</Text>
                  </View>
                </Option>
              ))}
              <Option label="Prioridad VIP" selected={draft.vip} onPress={() => updateDraft({ vip: !draft.vip })}>
                <View style={booking.row}>
                  <Sparkles size={19} color={colors.green} />
                  <View style={booking.optionText}>
                    <Text style={booking.name}>Prioridad VIP</Text>
                    <Text style={styles.caption}>+ {formatPrice(surcharge)}</Text>
                  </View>
                  {draft.vip && <Check size={17} color={colors.green} />}
                </View>
              </Option>
            </Card>
            <Card style={booking.calendar}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Fecha</Text>
              <View style={booking.options}>
                {dates.map((item) => (
                  <Option key={item.key} compact label={item.weekday + ' ' + item.day}
                    selected={item.key === date} onPress={() => updateDraft({ date: item.key, time: '' })}>
                    <Text style={styles.caption}>{item.weekday}</Text>
                    <Text style={booking.name}>{item.day}</Text>
                  </Option>
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Horario</Text>
              <View style={booking.options}>
                {times.map((time) => (
                  <Option key={time} compact label={time} disabled={!available(time)}
                    selected={time === draft.time} onPress={() => updateDraft({ date, time })}>
                    <Text style={booking.name}>{time}</Text>
                  </Option>
                ))}
              </View>
              {live && !service && <Text style={styles.caption}>Elegí un servicio para consultar sus horarios.</Text>}
              {live && service && !result && <Text style={styles.caption}>Cargando disponibilidad…</Text>}
              {result?.error && (
                <>
                  <Message error>No pudimos consultar los horarios.</Message>
                  <Button onPress={() => setRevision((value) => value + 1)} variant="outline">Reintentar</Button>
                </>
              )}
              {(!live || result?.times) && !times.some(available) && (
                <Text style={styles.caption}>Elegí otra fecha para ver más horarios.</Text>
              )}
            </Card>
          </View>
          <View style={booking.total}>
            <Text style={styles.body}>Total</Text>
            <Text style={booking.totalPrice}>{service ? formatPrice(service.price + (draft.vip ? surcharge : 0)) : '—'}</Text>
          </View>
          <Button onPress={next} disabled={!canContinue} icon={ArrowRight}>Continuar</Button>
        </>
      )}
    </Screen>
  )
}

const booking = StyleSheet.create({
  columns: { gap: 14 },
  columnsWide: { flexDirection: 'row', alignItems: 'stretch' },
  services: { flex: 1 },
  calendar: { flex: 1.25 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 8, minHeight: 45, padding: 9, justifyContent: 'center' },
  compact: { minWidth: 49, alignItems: 'center', paddingHorizontal: 8 },
  selected: { borderColor: colors.green, backgroundColor: colors.greenDark },
  hover: { borderColor: colors.green },
  disabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, justifyContent: 'space-between' },
  optionText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  price: { color: colors.green, fontSize: 14, fontWeight: '700' },
  total: { paddingHorizontal: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalPrice: { color: colors.green, fontWeight: '800', fontSize: 21 },
})
