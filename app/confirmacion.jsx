import { Redirect } from 'expo-router'
import CalendarCheck from 'lucide-react-native/icons/calendar-check'
import { View } from 'react-native'
import { BookingSummary } from '../src/components/booking-summary'
import { Button, colors, Heading, Message, Screen } from '../src/components/ui'
import { Status } from '../src/components/status'
import { useTurnia } from '../src/domain/turnia'

export default function Confirmation() {
  const { live, receipt } = useTurnia()
  if (!receipt) return <Redirect href="/reservar" />

  return (
    <Screen>
      <View style={{ alignSelf: 'flex-start', padding: 15, borderRadius: 12, backgroundColor: colors.greenDark }}>
        <CalendarCheck size={27} color={colors.green} />
      </View>
      <Heading label="Reserva · 3 de 3" title={live ? '¡Solicitud guardada!' : '¡Turno de prueba solicitado!'}
        subtitle={live ? `${receipt.name}, guardá el código para identificar tu solicitud.`
          : `${receipt.name}, tu turno quedó pendiente en la agenda de demostración.`} />
      <BookingSummary {...receipt} />
      {live && (
        <>
          <Status status={receipt.status} />
          <Message>Código de turno: {receipt.id}</Message>
        </>
      )}
      <Button href="/">Volver al inicio</Button>
    </Screen>
  )
}
