<script setup>
import { useRouter } from 'vue-router'
import { booking, selectedService, totalPrice, resetBooking } from '../../store/booking'

const router = useRouter()
const service = selectedService()

if (!service) {
  router.replace({ name: 'home' })
}

function backToHome() {
  resetBooking()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="screen screen--client" v-if="service">
    <div class="card">
      <div class="step-indicator">
        <span class="step-indicator__num">3</span>
        <span class="step-indicator__label">de 3 — listo</span>
      </div>

      <h2 class="confirm-title">Turno reservado</h2>
      <p class="confirm-detail">
        {{ service.name }} el día de hoy a las {{ booking.time }}hs.
        <span v-if="booking.vip">Tenés prioridad VIP.</span>
      </p>
      <p class="confirm-total">Total: ${{ totalPrice().toLocaleString('es-AR') }}</p>

      <p class="confirm-note">
        Te mandamos la confirmación por WhatsApp o email a
        {{ booking.name }}. Guardá este turno, no hace falta que vuelvas a escribirnos.
      </p>

      <button class="btn btn--ghost" @click="backToHome">Volver al inicio</button>
    </div>
  </div>
</template>

<style scoped>
.confirm-title {
  font-size: 24px;
  color: var(--color-teal);
  margin-bottom: 12px;
}

.confirm-detail {
  color: var(--color-text);
  margin-bottom: 8px;
}

.confirm-total {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 20px;
}

.confirm-note {
  font-size: 13px;
  margin-bottom: 28px;
}
</style>
