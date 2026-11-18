import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../src/domain/auth'
import { TurniaProvider } from '../src/domain/turnia'
import { colors } from '../src/components/ui'

export default function Layout() {
  return (
    <AuthProvider>
      <TurniaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ title: 'Turnia · Barbería' }} />
          <Stack.Screen name="reservar" options={{ title: 'Reservar turno · Turnia' }} />
          <Stack.Screen name="confirmar" options={{ title: 'Tus datos · Turnia' }} />
          <Stack.Screen name="confirmacion" options={{ title: 'Solicitud de turno · Turnia' }} />
          <Stack.Screen name="admin" options={{ title: 'Agenda · Turnia' }} />
        </Stack>
      </TurniaProvider>
    </AuthProvider>
  )
}
