import { Link } from 'expo-router'
import ArrowLeft from 'lucide-react-native/icons/arrow-left'
import ArrowRight from 'lucide-react-native/icons/arrow-right'
import Scissors from 'lucide-react-native/icons/scissors'
import UserRound from 'lucide-react-native/icons/user-round'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useTurnia } from '../domain/turnia'
import { SafeAreaView } from 'react-native-safe-area-context'

export const colors = {
  bg: '#111714',
  panel: '#19211b',
  border: '#303e33',
  text: '#f5f3e9',
  muted: '#aeb9aa',
  green: '#c1eaa5',
  greenDark: '#243b29',
  coral: '#f4a58e',
  coralDark: '#442c28',
  ink: '#172416',
}

export function Button({ children, href, onPress, variant = 'primary', disabled, icon: Icon, style }) {
  const quiet = variant === 'outline' || variant === 'text'
  const foreground = quiet ? colors.text : colors.ink
  const button = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button, styles[variant], style,
        (pressed || hovered) && styles.buttonActive,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, { color: foreground }]}>{children}</Text>
      {Icon && <Icon size={17} color={foreground} />}
    </Pressable>
  )
  return href ? <Link href={href} asChild>{button}</Link> : button
}

export function Screen({ children, home = false, admin = false }) {
  const { live } = useTurnia()
  const { width } = useWindowDimensions()
  const narrow = width < 620
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={[styles.shell, styles.nav, narrow && styles.navNarrow]}>
            <Link href="/" asChild>
              <Pressable accessibilityLabel="Turnia, inicio" accessibilityRole="link" style={styles.brand}>
                <View style={styles.brandIcon}><Scissors size={19} color={colors.ink} /></View>
                <Text style={styles.brandText}>turnia<Text style={{ color: colors.green }}>.</Text></Text>
              </Pressable>
            </Link>
            <Button
              href={admin ? '/reservar' : '/admin/login'}
              variant="outline"
              icon={admin ? ArrowRight : UserRound}
              style={styles.navButton}
            >
              {admin ? 'Reservar turno' : narrow ? 'Soy barbero' : 'Soy el barbero'}
            </Button>
          </View>
        </View>
        <View style={[styles.shell, styles.content, home ? styles.homeContent : styles.innerContent, narrow && styles.contentNarrow]}>
          {children}
        </View>
        <View style={styles.footer}>
          <View style={[styles.shell, styles.footerInner]}>
            <Text style={styles.brandText}>turnia<Text style={{ color: colors.green }}>.</Text></Text>
            <Text style={styles.caption}>{live ? 'Turnos de barbería' : 'Demo de Turnia'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function Heading({ title, subtitle, label, admin = false }) {
  return (
    <View style={styles.heading}>
      {label && <Text style={[styles.label, admin && styles.adminLabel]}>{label}</Text>}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.body}>{subtitle}</Text>}
    </View>
  )
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  )
}

export function BackLink({ href, children = 'Volver' }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.back}>
        <ArrowLeft size={15} color={colors.muted} />
        <Text style={styles.caption}>{children}</Text>
      </Pressable>
    </Link>
  )
}

export function Message({ children, error = false }) {
  return (
    <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={[styles.message, error && styles.error]}>
      {children}
    </Text>
  )
}

export const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  scrollContent: { flexGrow: 1 },
  shell: { width: '100%', maxWidth: 1200, paddingHorizontal: 28, alignSelf: 'center' },
  header: { borderBottomWidth: 1, borderColor: colors.border },
  nav: { minHeight: 76, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  navNarrow: { minHeight: 66, paddingHorizontal: 18 },
  navButton: { paddingHorizontal: 15, minHeight: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  brandIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.8 },
  content: { flex: 1 },
  homeContent: { paddingTop: 40, paddingBottom: 62 },
  innerContent: { maxWidth: 850, paddingTop: 36, paddingBottom: 60, gap: 20 },
  contentNarrow: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 40 },
  footer: { borderTopWidth: 1, borderColor: colors.border },
  footerInner: { minHeight: 75, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 9, borderWidth: 1, borderColor: 'transparent', borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  primary: { backgroundColor: colors.green },
  admin: { backgroundColor: colors.coral },
  outline: { borderColor: colors.border, backgroundColor: colors.bg },
  text: { backgroundColor: 'transparent' },
  buttonActive: { opacity: 0.82 },
  disabled: { opacity: 0.48 },
  buttonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  heading: { gap: 8 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.1 },
  label: { color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  adminLabel: { color: colors.coral },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18, gap: 14 },
  field: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.bg, fontSize: 16 },
  back: { minHeight: 33, flexDirection: 'row', gap: 7, alignItems: 'center', alignSelf: 'flex-start' },
  message: { color: colors.text, backgroundColor: colors.greenDark, borderRadius: 8, padding: 12, lineHeight: 21, fontSize: 14 },
  error: { backgroundColor: colors.coralDark, color: colors.coral },
})
