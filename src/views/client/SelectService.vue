<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { booking, businesses, catalog, loadBusinesses, resetBooking, selectBusiness, services, timeSlots, VIP_SURCHARGE } from '../../store/booking'
import { availability, clearAvailability, isConfirmedSlot, isSlotAvailable, refreshAvailability } from '../../store/turnos'
import { businessDate, isBookableDate, isFutureSlot } from '../../utils/dates'
import { useClock } from '../../composables/useClock'

const router = useRouter()
// Returning after submission starts a new draft, not an edit of the sent request.
if (booking.turnoId) resetBooking()
const now = useClock()
const today = computed(() => businessDate(now.value))
const validDate = computed(() => isBookableDate(booking.date, now.value))
const available = (slot) => isSlotAvailable(booking.date, slot, now.value)
const hasAvailability = computed(() => timeSlots.some(available))
onMounted(loadBusinesses)

function refresh() {
  if (booking.barberId && validDate.value) return refreshAvailability(booking.barberId, booking.date)
  clearAvailability()
}
watch(() => [booking.barberId, booking.date, now.value], refresh, { immediate: true })

watch(() => booking.date, () => { booking.time = null })
watch(() => [now.value, booking.time && available(booking.time)], () => {
  if (booking.time && !available(booking.time)) booking.time = null
}, { immediate: true })

function canContinue() {
  return !catalog.loading && !availability.loading && services.some((service) => service.id === booking.serviceId) && available(booking.time)
}

function goNext() {
  if (canContinue()) router.push({ name: 'confirm-data' })
}
</script>

<template>
  <div class="screen screen--client">
    <div class="card">
      <router-link class="back-link" :to="{ name: 'home' }">
        <span aria-hidden="true">←</span> Volver al inicio
      </router-link>

      <div class="step-indicator">
        <span class="step-indicator__num">1</span>
        <span class="step-indicator__label">de 3 — servicio, fecha y horario</span>
      </div>

      <p v-if="catalog.loading" role="status">Cargando servicios…</p>
      <div v-if="catalog.error" class="form-error" role="alert">
        {{ catalog.error }}
        <button type="button" class="btn btn--ghost" @click="loadBusinesses">Reintentar</button>
      </div>
      <p v-if="catalog.loaded && !businesses.length && !catalog.loading" role="status">Todavía no hay barberías registradas.</p>
      <div v-if="businesses.length" class="field">
        <label for="business">Barbería</label>
        <select id="business" :value="booking.barberId || ''" @change="selectBusiness($event.target.value)">
          <option value="">Elegí una barbería</option>
          <option v-for="business in businesses" :key="business.id" :value="business.id">{{ business.business_name }}</option>
        </select>
      </div>
      <p v-if="booking.barberId && !catalog.loading && !catalog.error && !services.length" role="status">Esta barbería todavía no tiene servicios disponibles.</p>
      <h2 class="section-title">¿Qué te hacés?</h2>
      <div class="option-list">
        <button
          v-for="service in services"
          :key="service.id"
          class="option"
          type="button"
          :aria-pressed="booking.serviceId === service.id"
          @click="booking.serviceId = service.id"
        >
          <span>
            <strong>{{ service.name }}</strong>
            <br />
            <small>{{ service.duration }}</small>
          </span>
          <span class="option__price">${{ service.price.toLocaleString('es-AR') }}</span>
        </button>
      </div>

      <div class="field">
        <label for="booking-date">Elegí la fecha</label>
        <input id="booking-date" v-model="booking.date" type="date" :min="today" required
          :aria-invalid="Boolean(booking.date && !validDate)" aria-describedby="date-help" />
        <p id="date-help" class="date-help">Horarios de Buenos Aires. Solo se permiten fechas desde hoy.</p>
      </div>
      <p v-if="booking.date && !validDate" class="form-error" role="alert">Elegí una fecha válida que no haya pasado.</p>

      <h2 class="section-title">Elegí el horario</h2>
      <p v-if="!booking.date" class="date-help">Seleccioná una fecha para ver los horarios disponibles.</p>
      <p v-else-if="!booking.barberId" class="date-help">Elegí una barbería para consultar disponibilidad.</p>
      <p v-else-if="availability.loading" class="date-help" role="status">Consultando disponibilidad…</p>
      <div v-else-if="availability.error" class="form-error" role="alert">{{ availability.error }} <button type="button" @click="refresh">Reintentar</button></div>
      <p v-else-if="validDate && availability.ready && !hasAvailability" class="date-help" role="status">No quedan horarios disponibles para esta fecha. Elegí otro día.</p>
      <div class="time-grid">
        <button
          v-for="slot in timeSlots"
          :key="slot"
          class="time-slot"
          type="button"
          :aria-pressed="booking.time === slot && available(slot)"
          :disabled="!available(slot)"
          @click="booking.time = slot"
        >
          {{ slot }}
          <small v-if="validDate && isConfirmedSlot(booking.date, slot)">Ocupado</small>
          <small v-else-if="validDate && !isFutureSlot(booking.date, slot, now)">Ya pasó</small>
        </button>
      </div>

      <label class="vip-toggle">
        <input type="checkbox" v-model="booking.vip" />
        <span>
          Quiero prioridad (VIP) — salteo la fila por
          ${{ VIP_SURCHARGE.toLocaleString('es-AR') }} extra
        </span>
      </label>

      <button class="btn btn--teal" :disabled="!canContinue()" @click="goNext">
        Continuar
      </button>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-bottom: 12px;
  color: var(--color-teal);
  font-size: 14px;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.section-title {
  font-size: 18px;
  margin: 20px 0 12px;
}

.section-title:first-of-type {
  margin-top: 0;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.time-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
}

.time-slot:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.time-slot small, .date-help {
  font-size: 12px;
}

.date-help {
  margin-bottom: 12px;
}

.time-slot[aria-pressed='true'] {
  border-color: var(--color-teal);
  background: var(--color-teal-dim);
  color: var(--color-teal);
}

.vip-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px dashed var(--color-teal);
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 13px;
  color: var(--color-text);
}

.vip-toggle input {
  margin-top: 2px;
}
</style>
