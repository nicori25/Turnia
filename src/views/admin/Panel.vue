<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadAgenda, turnos } from '../../store/turnos'
import { authState, logout } from '../../store/auth'
import { businessDate, formatDate, isValidDate } from '../../utils/dates'
import { useClock } from '../../composables/useClock'
import { deleteAppointment } from '../../services/turnia'

const router = useRouter()
const route = useRoute()
const date = ref(isValidDate(route.query.date) ? route.query.date : businessDate())
const loading = ref(false)
const error = ref('')
const deleting = ref(null)
const now = useClock()
const dailyTurnos = computed(() => turnos.filter((t) => t.date === date.value))
const businessName = computed(() => authState.user?.user_metadata?.business_name || 'Mi barbería')
async function refresh() {
  if (!isValidDate(date.value)) return
  loading.value = true; error.value = ''
  try { await loadAgenda(date.value) } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
watch([date, now], (_values, _old, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  if (!isValidDate(date.value)) return
  loading.value = true; error.value = ''
  loadAgenda(date.value).catch((e) => { if (active) error.value = e.message })
    .finally(() => { if (active) loading.value = false })
}, { immediate: true })
function statusLabel(status) {
  return { confirmado: 'Confirmado', pendiente: 'Pendiente', cancelado: 'Cancelado' }[status] || status
}
async function salir() {
  try { await logout(); router.push({ name: 'home' }) } catch (e) { error.value = e.message }
}

async function remove(turno) {
  if (deleting.value) return
  if (!window.confirm(`¿Eliminar definitivamente el turno del ${formatDate(turno.date)} a las ${turno.time}? No se puede deshacer.`)) return
  deleting.value = turno.id; error.value = ''
  try {
    await deleteAppointment(turno.id)
    await refresh()
  } catch (e) { error.value = e.message }
  finally { deleting.value = null }
}
</script>

<template>
  <div class="admin-theme panel">
    <header class="panel__header">
      <div>
        <p class="panel__eyebrow">{{ businessName }}</p>
        <h1 class="panel__title">Agenda de turnos</h1>
      </div>
      <button class="btn btn--ghost panel__logout" type="button" @click="salir">
        Salir
      </button>
    </header>

    <router-link class="btn btn--coral panel__new" :to="{ name: 'admin-turno-nuevo', query: { date } }">+ Nuevo turno</router-link>
    <p class="panel__help">Creá turnos o usá Ver, Modificar y Eliminar en cada registro de la agenda.</p>

    <div class="field">
      <label for="agenda-date">Fecha de la agenda</label>
      <input id="agenda-date" v-model="date" type="date" />
    </div>
    <p class="panel__date">{{ formatDate(date) }}</p>
    <p v-if="loading" role="status">Cargando agenda…</p>
    <div v-if="error" class="form-error" role="alert">{{ error }} <button type="button" @click="refresh">Reintentar</button></div>
    <p v-if="!loading && !error && !dailyTurnos.length" role="status">No hay turnos para esta fecha.</p>
    <ul class="turno-list">
      <li v-for="turno in dailyTurnos" :key="turno.id" class="turno-item">
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
        <div class="turno-actions" role="group" :aria-label="`Acciones del turno de las ${turno.time}`">
          <router-link :to="{ name: 'admin-turno-detalle', params: { id: turno.id } }">Ver</router-link>
          <router-link :to="{ name: 'admin-turno-editar', params: { id: turno.id } }">Modificar</router-link>
          <button type="button" :disabled="Boolean(deleting)" @click="remove(turno)">
            {{ deleting === turno.id ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
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

.panel__date {
  margin-bottom: 16px;
}

.panel__new {
  margin-bottom: 24px;
  text-decoration: none;
}

.panel__help { margin-bottom: 24px; font-size: 13px; }
.turno-item {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-elevated);
}
.turno-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 12px 12px; }
.turno-actions a, .turno-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  text-decoration: none;
  font: inherit;
  font-size: 13px;
}
.turno-actions button { color: var(--color-coral); }
.turno-actions button:disabled { opacity: 0.5; cursor: wait; }

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
  border: 0;
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

.turno-row__status[data-status='cancelado'] {
  color: var(--color-coral);
}
</style>
