<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { booking, selectedService, submitBooking, totalPrice, validPhone, VIP_SURCHARGE } from '../../store/booking'
import { availability, isSlotAvailable, refreshAvailability } from '../../store/turnos'
import { formatDate } from '../../utils/dates'
import { useClock } from '../../composables/useClock'

const router = useRouter()
const service = selectedService()
const error = ref('')
const saving = ref(false)
const now = useClock()
const available = computed(() => isSlotAvailable(booking.date, booking.time, now.value))
watch(now, () => { if (booking.barberId && booking.date && !saving.value) void refreshAvailability(booking.barberId, booking.date) })

if (!service || !available.value) {
  router.replace({ name: 'select-service' })
}

function canContinue() {
  return !saving.value && available.value && booking.name.trim().length > 1 && booking.name.trim().length <= 100 && validPhone(booking.phone.trim())
}

async function confirm() {
  if (!canContinue()) return
  saving.value = true
  error.value = ''
  try {
    await submitBooking()
    router.push({ name: 'confirmation' })
  } catch (e) {
    error.value = e.message
  } finally { saving.value = false }
}
</script>

<template>
  <div class="screen screen--client" v-if="service">
    <div class="card">
      <router-link class="back-link" :to="{ name: 'select-service' }">← Cambiar fecha u horario</router-link>
      <div class="step-indicator">
        <span class="step-indicator__num">2</span>
        <span class="step-indicator__label">de 3 — tus datos</span>
      </div>

      <div class="summary">
        <div class="summary__row">
          <span>{{ service.name }} · {{ formatDate(booking.date) }} · {{ booking.time }}hs</span>
          <span>${{ service.price.toLocaleString('es-AR') }}</span>
        </div>
        <div class="summary__row" v-if="booking.vip">
          <span>Prioridad VIP</span>
          <span>${{ VIP_SURCHARGE.toLocaleString('es-AR') }}</span>
        </div>
        <div class="summary__row summary__row--total">
          <span>Total</span>
          <span>${{ totalPrice().toLocaleString('es-AR') }}</span>
        </div>
      </div>

      <div class="field">
        <label for="name">Nombre</label>
        <input id="name" v-model="booking.name" type="text" maxlength="100" :disabled="saving" placeholder="Tu nombre" />
      </div>

      <div class="field">
        <label for="phone">Teléfono</label>
        <input id="phone" v-model="booking.phone" type="tel" maxlength="30" :disabled="saving" placeholder="11 1234 5678" />
      </div>

      <button class="btn btn--teal" :disabled="!canContinue()" @click="confirm">
        {{ saving ? 'Guardando…' : 'Solicitar turno' }}
      </button>
      <p v-if="!available" class="form-error" role="alert">El horario ya no está disponible. Volvé a elegir fecha y horario.</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="availability.error" class="form-error" role="alert">{{ availability.error }}</p>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: var(--color-teal);
  font-size: 14px;
}

.summary {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-muted);
  padding: 6px 0;
}

.summary__row--total {
  border-top: 1px solid var(--color-border);
  margin-top: 6px;
  padding-top: 10px;
  color: var(--color-text);
  font-weight: 600;
}
</style>
