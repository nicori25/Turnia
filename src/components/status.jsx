import { StyleSheet, Text } from 'react-native'
import { colors } from './ui'

const labels = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

export function Status({ status }) {
  return <Text style={[statusStyle.badge, statusStyle[status]]}>{labels[status]}</Text>
}

const statusStyle = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  pendiente: { backgroundColor: '#403728', color: '#f5d699' },
  confirmado: { backgroundColor: colors.greenDark, color: colors.green },
  cancelado: { backgroundColor: colors.coralDark, color: colors.coral },
})
