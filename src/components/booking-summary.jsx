import { StyleSheet, Text, View } from 'react-native'
import { Card, colors, styles } from './ui'
import { formatDate, formatPrice, vipSurcharge } from '../domain/booking'

export function BookingSummary({ service, date, time, vip, price }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Resumen del turno</Text>
      <View style={summary.row}>
        <Text style={styles.body}>{service}</Text>
        <Text style={styles.body}>{formatPrice(price - (vip ? vipSurcharge : 0))}</Text>
      </View>
      <Text style={styles.body}>{formatDate(date)} · {time} h</Text>
      {vip && (
        <View style={summary.row}>
          <Text style={styles.body}>Prioridad VIP</Text>
          <Text style={styles.body}>{formatPrice(vipSurcharge)}</Text>
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
