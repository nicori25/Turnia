import { useRouter } from 'expo-router'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import CalendarDays from 'lucide-react-native/icons/calendar-days'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import Clock3 from 'lucide-react-native/icons/clock-3'
import Scissors from 'lucide-react-native/icons/scissors'
import Sparkles from 'lucide-react-native/icons/sparkles'
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Button, colors, Message, Screen, styles } from '../src/components/ui'
import { formatPrice } from '../src/domain/booking'
import { useTurnia } from '../src/domain/turnia'

const serviceIcons = [Scissors, Sparkles, CalendarDays]

export default function Home() {
  const router = useRouter()
  const { catalog, catalogError, live, reloadCatalog, startBooking } = useTurnia()
  const services = catalog?.services.slice(0, 3) ?? []
  const { width } = useWindowDimensions()
  const wide = width >= 880

  function book(service) {
    startBooking(service)
    router.push('/reservar')
  }

  return (
    <Screen home>
      <View style={[home.hero, wide && home.heroWide]}>
        <View style={[home.heroContent, wide && home.heroContentWide]}>
          <View style={home.studio}>
            <View style={home.dot} />
            <Text style={styles.label}>{live ? 'Turnos de barbería' : 'Martín Barber Studio'}</Text>
          </View>
          <Text accessibilityRole="header" style={[home.title, wide && home.titleWide]}>
            Tu próximo corte,<Text style={home.accent}> a un turno de distancia.</Text>
          </Text>
          <Text style={home.subtitle}>Elegí el servicio, encontrá tu horario y reservá en minutos.</Text>
          <Button onPress={() => book()} icon={ArrowRight} style={home.cta}>Reservar turno</Button>
          {!live && <View style={home.demo}>
            <CalendarDays size={15} color={colors.muted} />
            <Text style={styles.caption}>Demo de reservas · Los turnos son de prueba</Text>
          </View>}
        </View>
        <View style={[home.photoFrame, wide && home.photoFrameWide]}>
          <Image source={require('../assets/barbershop.jpg')} style={home.photo}
            accessibilityLabel="Sillones y espejos en el interior de una barbería" />
        </View>
      </View>
      <View style={home.catalog}>
        <View style={home.catalogHeading}>
          <Text accessibilityRole="header" style={styles.title}>Servicios</Text>
          <Text style={styles.body}>Elegí qué querés hacerte.</Text>
        </View>
        {catalogError && (
          <>
            <Message error>No pudimos cargar el catálogo.</Message>
            <Button variant="outline" onPress={reloadCatalog}>Reintentar</Button>
          </>
        )}
        {!catalog && !catalogError && <Message>Cargando servicios…</Message>}
        {catalog && !services.length && <Message>Todavía no hay servicios habilitados para reservar.</Message>}
        <View style={[home.services, wide && home.servicesWide]}>
          {services.map((service, index) => {
            const Icon = serviceIcons[index]
            return (
              <Pressable key={service.id} accessibilityRole="button"
                accessibilityLabel={`Reservar ${service.name}, ${service.duration} minutos, ${formatPrice(service.price)}${live ? ', ' + service.business : ''}`}
                onPress={() => book(service)}
                style={({ hovered, pressed }) => [home.service, (hovered || pressed) && home.serviceActive]}>
                <View style={home.serviceHeader}>
                  <View style={home.serviceIcon}><Icon size={20} color={colors.green} /></View>
                  <ChevronRight size={19} color={colors.muted} />
                </View>
                <Text style={home.serviceName}>{service.name}</Text>
                <Text style={styles.caption}>{live ? service.business : service.description}</Text>
                <View style={home.serviceMeta}>
                  <Text style={home.price}>{formatPrice(service.price)}</Text>
                  <View style={home.duration}>
                    <Clock3 size={14} color={colors.muted} />
                    <Text style={styles.caption}>{service.duration} min</Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </Screen>
  )
}

const home = StyleSheet.create({
  hero: { borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, overflow: 'hidden' },
  heroWide: { flexDirection: 'row', minHeight: 454 },
  heroContent: { padding: 23, gap: 18 },
  heroContentWide: { flex: 1.08, padding: 42, justifyContent: 'center' },
  studio: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { height: 7, width: 7, backgroundColor: colors.green, borderRadius: 4 },
  title: { color: colors.text, fontSize: 41, lineHeight: 43, fontWeight: '800', letterSpacing: -1.8 },
  titleWide: { fontSize: 66, lineHeight: 67, letterSpacing: -3.7 },
  accent: { color: colors.green },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 380 },
  cta: { alignSelf: 'flex-start', minWidth: 170 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  photoFrame: { height: 205, backgroundColor: colors.border },
  photoFrameWide: { flex: 1, height: 'auto', alignSelf: 'stretch' },
  photo: { height: '100%', width: '100%', resizeMode: 'cover' },
  catalog: { marginTop: 35, gap: 17 },
  catalogHeading: { gap: 3 },
  services: { gap: 12 },
  servicesWide: { flexDirection: 'row' },
  service: { flex: 1, padding: 17, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, gap: 9, minWidth: 0 },
  serviceActive: { borderColor: colors.green },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontSize: 20, fontWeight: '700', color: colors.text },
  serviceMeta: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  price: { color: colors.green, fontWeight: '700', fontSize: 17 },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 5 },
})
