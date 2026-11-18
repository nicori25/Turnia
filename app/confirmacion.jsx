import { Redirect } from 'expo-router'
import CalendarCheck from 'lucide-react-native/icons/calendar-check'
import { View } from 'react-native'
import { BookingSummary } from '../src/components/booking-summary'
import { Button, colors, Heading, Screen } from '../src/components/ui'
import { useDemo } from '../src/domain/demo'

export default function Confirmation() {
  const { receipt } = useDemo()
  if (!receipt) return <Redirect href="/reservar" />

  return (
    <Screen>
      <View style={{ alignSelf: 'flex-start', padding: 15, borderRadius: 12, backgroundColor: colors.greenDark }}>
        <CalendarCheck size={27} color={colors.green} />
      </View>
      <Heading label="Reserva · 3 de 3" title="¡Turno de prueba solicitado!"
        subtitle={`${receipt.name}, tu turno quedó pendiente en la agenda de demostración.`} />
      <BookingSummary {...receipt} />
      <Button href="/">Volver al inicio</Button>
    </Screen>
  )
}
