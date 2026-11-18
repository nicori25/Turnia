import { useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import Check from 'lucide-react-native/icons/check'
import Sparkles from 'lucide-react-native/icons/sparkles'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { BackLink, Button, Card, colors, Heading, Screen, styles } from '../src/components/ui'
import { formatPrice, services, slotAvailable, timeSlots, upcomingDates, vipSurcharge } from '../src/domain/booking'
import { useDemo } from '../src/domain/demo'

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
  const { draft, updateDraft, bookings } = useDemo()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const dates = upcomingDates()
  const date = dates.some(({ key }) => key === draft.date) ? draft.date : dates[0].key
  const service = services.find(({ id }) => id === draft.serviceId)
  const available = (time) => slotAvailable(bookings, date, time, service?.duration ?? 30)
  const canContinue = !!service && available(draft.time)

  function next() {
    if (!canContinue) return
    updateDraft({ date })
    router.push('/confirmar')
  }

  return (
    <Screen>
      <BackLink href="/" children="Inicio" />
      <Heading label="Reserva · 1 de 3" title="Elegí tu turno" subtitle="Seleccioná un servicio, una fecha y un horario." />
      <View style={[booking.columns, width >= 770 && booking.columnsWide]}>
        <Card style={booking.services}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Servicio</Text>
          {services.map((item) => (
            <Option key={item.id} label={item.name} selected={item.id === service?.id}
              onPress={() => updateDraft({ serviceId: item.id, time: '' })}>
              <View style={booking.row}>
                <View style={booking.optionText}>
                  <Text style={booking.name}>{item.name}</Text>
                  <Text style={styles.caption}>{item.duration} min</Text>
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
                <Text style={styles.caption}>+ {formatPrice(vipSurcharge)}</Text>
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
            {timeSlots.map((time) => (
              <Option key={time} compact label={time} disabled={!available(time)}
                selected={time === draft.time} onPress={() => updateDraft({ date, time })}>
                <Text style={booking.name}>{time}</Text>
              </Option>
            ))}
          </View>
          {!timeSlots.some(available) && <Text style={styles.caption}>Elegí otra fecha para ver más horarios.</Text>}
        </Card>
      </View>
      <View style={booking.total}>
        <Text style={styles.body}>Total</Text>
        <Text style={booking.totalPrice}>{service ? formatPrice(service.price + (draft.vip ? vipSurcharge : 0)) : '—'}</Text>
      </View>
      <Button onPress={next} disabled={!canContinue} icon={ArrowRight}>Continuar</Button>
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
