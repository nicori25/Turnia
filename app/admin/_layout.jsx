import { Stack } from 'expo-router'
import { colors } from '../../src/components/ui'

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="login" options={{ title: 'Acceso del barbero · Turnia' }} />
      <Stack.Screen name="registro" options={{ title: 'Registro · Turnia' }} />
      <Stack.Screen name="panel" options={{ title: 'Agenda del barbero · Turnia' }} />
      <Stack.Screen name="turno" options={{ title: 'Detalle del turno · Turnia' }} />
    </Stack>
  )
}
