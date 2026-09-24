<script setup>
import { useRouter } from 'vue-router'
import { getTurno, setEstado } from '../../store/turnos'

const props = defineProps({ id: [String, Number] })
const router = useRouter()
const turno = getTurno(props.id)

if (!turno) {
  router.replace({ name: 'admin-panel' })
}

function confirmar() {
  setEstado(turno.id, 'confirmado')
  router.push({ name: 'admin-panel' })
}

function cancelar() {
  setEstado(turno.id, 'cancelado')
  router.push({ name: 'admin-panel' })
}
</script>

<template>
  <div class="admin-theme screen screen--client" v-if="turno">
    <div class="card">
      <router-link class="back-link" :to="{ name: 'admin-panel' }">← Volver al panel</router-link>

      <p class="detail-time">{{ turno.time }}hs</p>
      <h1 class="detail-client">{{ turno.client }}</h1>
      <p class="detail-service">
        {{ turno.service }}
        <span v-if="turno.vip" class="detail-vip">VIP</span>
      </p>

      <div class="detail-actions">
        <button class="btn btn--coral" @click="confirmar">Confirmar turno</button>
        <button class="btn btn--ghost" @click="cancelar">Cancelar turno</button>
      </div>
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
