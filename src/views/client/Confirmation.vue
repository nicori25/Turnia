<script setup>
import { useRouter } from 'vue-router'
import { booking, selectedService, totalPrice, resetBooking } from '../../store/booking'
import { formatDate } from '../../utils/dates'

const router = useRouter()
const service = selectedService()

if (!service || !booking.receipt) {
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

      <h2 class="confirm-title">Solicitud recibida</h2>
      <p class="confirm-detail">
        {{ service.name }} el {{ formatDate(booking.date) }} a las {{ booking.time }}hs.
        <span v-if="booking.vip">Tenés prioridad VIP.</span>
      </p>
      <p class="confirm-total">Total: ${{ Number(booking.receipt?.precio_total ?? totalPrice()).toLocaleString('es-AR') }}</p>

      <p class="confirm-note">
        {{ booking.name }}, tu solicitud está pendiente de aceptación por el barbero.
        La solicitud se guardó en la barbería. El horario queda retenido mientras el profesional revisa la solicitud.
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
