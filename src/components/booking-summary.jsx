import { StyleSheet, Text, View } from 'react-native'
import { Card, colors, styles } from './ui'
import { formatDate, formatPrice } from '../domain/booking'

export function BookingSummary({ service, date, time, professional, business, surcharge = 0, price }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Resumen del turno</Text>
      <View style={summary.row}>
        <Text style={styles.body}>{service}</Text>
        <Text style={styles.body}>{formatPrice(price - surcharge)}</Text>
      </View>
      {professional && <Text style={styles.body}>{professional} · {business}</Text>}
      <Text style={styles.body}>{formatDate(date)} · {time} h</Text>
      {surcharge > 0 && (
        <View style={summary.row}>
          <Text style={styles.body}>Prioridad VIP</Text>
          <Text style={styles.body}>{formatPrice(surcharge)}</Text>
        </View>
      )}
      <View style={[summary.row, summary.total]}>
        <Text style={styles.sectionTitle}>Total</Text>
        <Text style={summary.amount}>{formatPrice(price)}</Text>
      </View>
    </Card>
  )
}

const summary = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 },
  amount: { fontSize: 19, fontWeight: '800', color: colors.green },
})
