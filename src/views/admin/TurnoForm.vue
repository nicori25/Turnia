<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { appointmentOptions, saveAppointment } from '../../services/turnia'
import { loadTurno, timeSlots } from '../../store/turnos'
import { validPhone, VIP_SURCHARGE } from '../../store/booking'
import { businessDate, isBookableDate, isFutureSlot, isValidDate } from '../../utils/dates'
import { useClock } from '../../composables/useClock'

const props = defineProps({ id: String })
const router = useRouter()
const route = useRoute()
const now = useClock()
const editing = computed(() => Boolean(props.id))
const options = ref({ profesionales: [], servicios: [] })
const loading = ref(true), saving = ref(false), error = ref('')
const initial = ref(null)
const form = reactive({ professional: '', service: '', date: '', time: '', name: '', phone: '', vip: false, status: 'pendiente' })
let requestId = crypto.randomUUID(), fingerprint = ''
const services = computed(() => options.value.servicios.filter((s) => !s.profesional_id || s.profesional_id === form.professional))
const service = computed(() => services.value.find((s) => s.id === form.service))
const total = computed(() => Number(service.value?.precio ?? 0) + (form.vip ? VIP_SURCHARGE : 0))
const historicalUnchanged = computed(() => initial.value && initial.value.date === form.date && initial.value.time === form.time &&
  initial.value.barberId === form.professional && initial.value.serviceId === form.service && initial.value.status === form.status)
const validation = computed(() => {
  if (!options.value.profesionales.some((p) => p.id === form.professional)) return { field: 'professional', message: 'Elegí un profesional activo.' }
  if (!service.value) return { field: 'service', message: 'Elegí un servicio disponible para ese profesional.' }
  if (!isValidDate(form.date)) return { field: 'date', message: 'Completá una fecha válida.' }
  if (!timeSlots.includes(form.time)) return { field: 'time', message: 'Elegí un horario de la lista.' }
  if (!isFutureSlot(form.date, form.time, now.value) && !historicalUnchanged.value) {
    return { field: 'date', message: 'Para cambiar el servicio, profesional, estado o fecha de un turno pasado, elegí una fecha y hora futuras. Podés corregir el nombre y teléfono manteniendo los demás datos originales.' }
  }
  if (form.name.trim().length < 2 || form.name.trim().length > 100) return { field: 'client-name', message: 'El nombre debe tener entre 2 y 100 caracteres.' }
  if (!validPhone(form.phone.trim())) return { field: 'client-phone', message: 'Ingresá un teléfono con entre 6 y 20 dígitos. Se permiten espacios, +, paréntesis y guiones.' }
  return null
})
async function load() {
  loading.value = true; error.value = ''; initial.value = null
  try {
    const data = await appointmentOptions()
    options.value = data
    Object.assign(form, { professional: data.profesionales[0]?.id ?? '', service: '',
      date: isBookableDate(route.query.date, now.value) ? route.query.date : businessDate(now.value),
      time: '', name: '', phone: '', vip: false, status: 'pendiente' })
    if (props.id) {
      const record = await loadTurno(props.id)
      if (!record) throw new Error('No encontramos el turno o no tenés permiso para editarlo.')
      initial.value = record
      Object.assign(form, { professional: record.barberId, service: record.serviceId, date: record.date,
        time: record.time, name: record.client, phone: record.phone, vip: record.vip, status: record.status })
    }
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
watch(() => props.id, load, { immediate: true })
watch(() => form.professional, () => {
  if (!services.value.some((s) => s.id === form.service)) form.service = ''
})
async function save() {
  if (saving.value || loading.value) return
  if (validation.value) {
    error.value = validation.value.message
    document.getElementById(validation.value.field)?.focus()
    return
  }
  saving.value = true; error.value = ''
  const data = { p_id: props.id || null, p_profesional_id: form.professional, p_servicio_id: form.service,
    p_fecha: form.date, p_hora: form.time, p_nombre: form.name.trim(), p_telefono: form.phone.trim(),
    p_vip: form.vip, p_estado: form.status }
  const current = JSON.stringify(data)
  if (current !== fingerprint) requestId = crypto.randomUUID()
  fingerprint = current
  try {
    const result = await saveAppointment({ ...data, p_solicitud_id: requestId })
    router.push({ name: 'admin-panel', query: { date: result.fecha } })
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="screen screen--client admin-theme">
    <div class="card">
      <router-link class="back" :to="{ name: 'admin-panel', query: { date: form.date } }">← Volver a la agenda</router-link>
      <h1>{{ editing ? 'Modificar turno' : 'Nuevo turno' }}</h1>
      <p v-if="loading" role="status">Cargando formulario…</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button v-if="!loading && (!options.profesionales.length || (editing && !initial))" type="button" class="btn btn--ghost" @click="load">Reintentar carga</button>
      <form v-if="!loading && options.profesionales.length && (!editing || initial)" novalidate @submit.prevent="save">
        <fieldset :disabled="saving">
          <div class="field"><label for="professional">Profesional</label><select id="professional" v-model="form.professional" required><option v-for="p in options.profesionales" :key="p.id" :value="p.id">{{ p.nombre }}</option></select></div>
          <div class="field"><label for="service">Servicio</label><select id="service" v-model="form.service" required><option value="">Elegí un servicio</option><option v-for="s in services" :key="s.id" :value="s.id">{{ s.nombre }} · {{ s.duracion_min }} min</option></select></div>
          <div class="field"><label for="date">Fecha</label><input id="date" v-model="form.date" type="date" :min="historicalUnchanged ? undefined : businessDate(now)" required /></div>
          <div class="field"><label for="time">Horario</label><select id="time" v-model="form.time" required><option value="">Elegí un horario</option><option v-for="t in timeSlots" :key="t" :value="t">{{ t }}</option></select></div>
          <div class="field"><label for="client-name">Nombre del cliente</label><input id="client-name" v-model="form.name" maxlength="100" required /></div>
          <div class="field"><label for="client-phone">Teléfono</label><input id="client-phone" v-model="form.phone" type="tel" maxlength="30" required /></div>
          <div class="field"><label for="status">Estado</label><select id="status" v-model="form.status"><option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="cancelado">Cancelado</option></select></div>
          <label class="vip"><input v-model="form.vip" type="checkbox" /> Prioridad VIP (+${{ VIP_SURCHARGE.toLocaleString('es-AR') }})</label>
          <p class="price">Total: ${{ total.toLocaleString('es-AR') }}</p>
          <p class="hint">Horarios de Buenos Aires. El servidor comprueba los permisos y los solapamientos al guardar.</p>
          <button class="btn btn--coral" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear turno' }}</button>
        </fieldset>
      </form>
      <p v-if="!loading && !error && !options.profesionales.length" role="status">No tenés un profesional activo disponible. Revisá la vinculación con el administrador.</p>
    </div>
  </div>
</template>

<style scoped>
.back { display: inline-block; margin-bottom: 18px; color: var(--color-coral); font-size: 14px; }
h1 { margin-bottom: 24px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.vip { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 16px; }
.price { color: var(--color-text); font-weight: 600; margin-bottom: 12px; }
.hint { font-size: 12px; margin-bottom: 20px; }
</style>
