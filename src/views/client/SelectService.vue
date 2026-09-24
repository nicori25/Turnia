<script setup>
import { useRouter } from 'vue-router'
import { booking, services, timeSlots, VIP_SURCHARGE } from '../../store/booking'

const router = useRouter()

function canContinue() {
  return booking.serviceId && booking.time
}

function goNext() {
  if (canContinue()) router.push({ name: 'confirm-data' })
}
</script>

<template>
  <div class="screen screen--client">
    <div class="card">
      <div class="step-indicator">
        <span class="step-indicator__num">1</span>
        <span class="step-indicator__label">de 3 — servicio y horario</span>
      </div>

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

      <h2 class="section-title">Elegí el horario</h2>
      <div class="time-grid">
        <button
          v-for="slot in timeSlots"
          :key="slot"
          class="time-slot"
          type="button"
          :aria-pressed="booking.time === slot"
          @click="booking.time = slot"
        >
          {{ slot }}
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
  padding: 12px 0;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
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
