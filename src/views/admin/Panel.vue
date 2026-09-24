<script setup>
import { useRouter } from 'vue-router'
import { turnos } from '../../store/turnos'
import { logout } from '../../store/auth'

const router = useRouter()

function statusLabel(status) {
  return status === 'confirmado' ? 'Confirmado' : 'Pendiente'
}

async function salir() {
  await logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="admin-theme panel">
    <header class="panel__header">
      <div>
        <p class="panel__eyebrow">Martín Barber Studio</p>
        <h1 class="panel__title">Turnos de hoy</h1>
      </div>
      <button class="btn btn--ghost panel__logout" type="button" @click="salir">
        Salir
      </button>
    </header>

    <ul class="turno-list">
      <li v-for="turno in turnos" :key="turno.id">
        <button
          class="turno-row"
          type="button"
          @click="router.push({ name: 'admin-turno-detalle', params: { id: turno.id } })"
        >
          <span class="turno-row__time">{{ turno.time }}</span>
          <span class="turno-row__info">
            <strong>{{ turno.client }}</strong>
            <small>{{ turno.service }}</small>
          </span>
          <span v-if="turno.vip" class="turno-row__vip">VIP</span>
          <span class="turno-row__status" :data-status="turno.status">
            {{ statusLabel(turno.status) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.panel {
  min-height: 100vh;
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.panel__eyebrow {
  font-size: 13px;
  color: var(--color-coral);
  margin-bottom: 4px;
}

.panel__title {
  font-size: 28px;
}

.panel__logout {
  width: auto;
  padding: 10px 18px;
}

.turno-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.turno-row {
  width: 100%;
  display: grid;
  grid-template-columns: 52px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  text-align: left;
}

.turno-row__time {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-coral);
}

.turno-row__info {
  display: flex;
  flex-direction: column;
}

.turno-row__info small {
  color: var(--color-text-muted);
}

.turno-row__vip {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-coral);
  border: 1px solid var(--color-coral);
  border-radius: 999px;
  padding: 2px 8px;
}

.turno-row__status {
  font-size: 12px;
  color: var(--color-text-muted);
}

.turno-row__status[data-status='confirmado'] {
  color: var(--color-teal);
}
</style>
