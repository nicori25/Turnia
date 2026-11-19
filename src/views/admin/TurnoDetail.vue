<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getTurno, isSlotAvailable, setEstado } from '../../store/turnos'
import { formatDate } from '../../utils/dates'
import { useClock } from '../../composables/useClock'

const props = defineProps({ id: [String, Number] })
const router = useRouter()
const turno = getTurno(props.id)
const error = ref('')
const now = useClock()
const canConfirm = computed(() => turno && turno.status === 'pendiente' &&
  isSlotAvailable(turno.date, turno.time, now.value, turno.id))

if (!turno) {
  router.replace({ name: 'admin-panel' })
}

function confirmar() {
  try {
    setEstado(turno.id, 'confirmado')
    router.push({ name: 'admin-panel', query: { date: turno.date } })
  } catch (e) {
    error.value = e.message
  }
}

function cancelar() {
  setEstado(turno.id, 'cancelado')
  router.push({ name: 'admin-panel', query: { date: turno.date } })
}
</script>

<template>
  <div class="admin-theme screen screen--client" v-if="turno">
    <div class="card">
      <router-link class="back-link" :to="{ name: 'admin-panel', query: { date: turno.date } }">← Volver al panel</router-link>

      <p class="detail-time">{{ formatDate(turno.date) }} · {{ turno.time }}hs</p>
      <h1 class="detail-client">{{ turno.client }}</h1>
      <p class="detail-service">
        {{ turno.service }}
        <span v-if="turno.vip" class="detail-vip">VIP</span>
      </p>

      <div class="detail-actions">
        <button class="btn btn--coral" :disabled="!canConfirm" @click="confirmar">Confirmar turno</button>
        <button class="btn btn--ghost" :disabled="turno.status === 'cancelado'" @click="cancelar">Cancelar turno</button>
      </div>
      <p v-if="turno.status === 'pendiente' && !canConfirm" class="form-error" role="status">La fecha ya pasó o hay otro turno confirmado en ese horario.</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-block;
  font-size: 13px;
  color: var(--color-text-muted);
  text-decoration: none;
  margin-bottom: 24px;
}

.detail-time {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--color-coral);
  margin-bottom: 4px;
}

.detail-client {
  font-size: 26px;
  margin-bottom: 8px;
}

.detail-service {
  color: var(--color-text-muted);
  margin-bottom: 28px;
}

.detail-vip {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-coral);
  border: 1px solid var(--color-coral);
  border-radius: 999px;
  padding: 2px 8px;
  margin-left: 6px;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
