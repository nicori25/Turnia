<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { loadTurno, setEstado } from '../../store/turnos'
import { formatDate, isFutureSlot } from '../../utils/dates'
import { useClock } from '../../composables/useClock'
import { deleteAppointment } from '../../services/turnia'

const props = defineProps({ id: String })
const router = useRouter()
const turno = ref(null)
const error = ref('')
const loading = ref(true)
const saving = ref(false)
const now = useClock()
const canConfirm = computed(() => turno.value && turno.value.status === 'pendiente' &&
  isFutureSlot(turno.value.date, turno.value.time, now.value))
async function refresh() {
  loading.value = true; error.value = ''
  try { turno.value = await loadTurno(props.id) } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
watch(() => props.id, refresh, { immediate: true })
async function update(status) {
  if (saving.value || !turno.value) return
  saving.value = true; error.value = ''
  try {
    await setEstado(turno.value.id, status)
    router.push({ name: 'admin-panel', query: { date: turno.value.date } })
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function remove() {
  if (saving.value || !turno.value) return
  if (!window.confirm(`¿Eliminar definitivamente el turno del ${formatDate(turno.value.date)} a las ${turno.value.time}? No se puede deshacer.`)) return
  saving.value = true; error.value = ''
  try {
    await deleteAppointment(turno.value.id)
    router.push({ name: 'admin-panel', query: { date: turno.value.date } })
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="admin-theme screen screen--client">
    <div v-if="loading" class="card" role="status">Cargando turno…</div>
    <div v-else-if="!turno" class="card"><p role="alert">{{ error || 'No encontramos ese turno o no tenés permiso para verlo.' }}</p><router-link :to="{ name: 'admin-panel' }">Volver al panel</router-link><button type="button" @click="refresh">Reintentar</button></div>
    <div v-else class="card">
      <router-link class="back-link" :to="{ name: 'admin-panel', query: { date: turno.date } }">← Volver al panel</router-link>

      <p class="detail-time">{{ formatDate(turno.date) }} · {{ turno.time }}hs</p>
      <h1 class="detail-client">{{ turno.client }}</h1>
      <p class="detail-service">
        {{ turno.service }}
        <span v-if="turno.vip" class="detail-vip">VIP</span>
      </p>

      <div class="detail-actions">
        <router-link v-if="!saving" class="btn btn--coral detail-edit" :to="{ name: 'admin-turno-editar', params: { id: turno.id } }">Modificar turno</router-link>
        <button class="btn btn--coral" :disabled="saving || !canConfirm" @click="update('confirmado')">Confirmar turno</button>
        <button class="btn btn--ghost" :disabled="saving || turno.status === 'cancelado'" @click="update('cancelado')">Cancelar turno</button>
        <button class="btn btn--ghost detail-delete" :disabled="saving" @click="remove">Eliminar turno</button>
      </div>
      <p v-if="turno.status === 'pendiente' && !canConfirm" class="form-error" role="status">La fecha o el horario ya pasaron.</p>
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

.detail-edit { text-decoration: none; }
.detail-delete { color: var(--color-coral); border-color: var(--color-coral); }
</style>
