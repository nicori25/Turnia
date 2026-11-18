import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../src/domain/auth'
import { DemoProvider } from '../src/domain/demo'
import { colors } from '../src/components/ui'

export default function Layout() {
  return (
    <AuthProvider>
      <DemoProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ title: 'Turnia · Barbería' }} />
          <Stack.Screen name="reservar" options={{ title: 'Reservar turno · Turnia' }} />
          <Stack.Screen name="confirmar" options={{ title: 'Tus datos · Turnia' }} />
          <Stack.Screen name="confirmacion" options={{ title: 'Reserva de prueba · Turnia' }} />
          <Stack.Screen name="admin" options={{ title: 'Agenda · Turnia' }} />
        </Stack>
      </DemoProvider>
    </AuthProvider>
  )
}
