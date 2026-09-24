<script setup>
import { useRouter } from 'vue-router'
import { booking, selectedService, totalPrice, VIP_SURCHARGE } from '../../store/booking'

const router = useRouter()
const service = selectedService()

if (!service || !booking.time) {
  router.replace({ name: 'select-service' })
}

function canContinue() {
  return booking.name.trim().length > 1 && booking.phone.trim().length > 5
}

function confirm() {
  if (canContinue()) router.push({ name: 'confirmation' })
}
</script>

<template>
  <div class="screen screen--client" v-if="service">
    <div class="card">
      <div class="step-indicator">
        <span class="step-indicator__num">2</span>
        <span class="step-indicator__label">de 3 — tus datos</span>
      </div>

      <div class="summary">
        <div class="summary__row">
          <span>{{ service.name }} · {{ booking.time }}hs</span>
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
        <input id="name" v-model="booking.name" type="text" placeholder="Tu nombre" />
      </div>

      <div class="field">
        <label for="phone">Teléfono</label>
        <input id="phone" v-model="booking.phone" type="tel" placeholder="11 1234 5678" />
      </div>

      <button class="btn btn--teal" :disabled="!canContinue()" @click="confirm">
        Confirmar turno
      </button>
    </div>
  </div>
</template>

<style scoped>
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
