<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../../store/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function canContinue() {
  return email.value.trim().length > 3 && password.value.length >= 6
}

async function submit() {
  if (!canContinue() || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await login({ email: email.value, password: password.value })
    router.push({ name: 'admin-panel' })
  } catch (e) {
    error.value = 'Email o contraseña incorrectos.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="screen screen--client admin-theme">
    <div class="card">
      <p class="login-eyebrow">Turnia · panel del barbero</p>
      <h1 class="login-title">Ingresá a tu agenda</h1>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" placeholder="martin@turnia.com" />
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input id="password" v-model="password" type="password" placeholder="••••••••" />
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <button class="btn btn--coral" :disabled="!canContinue() || loading" @click="submit">
        {{ loading ? 'Ingresando…' : 'Entrar' }}
      </button>

      <router-link class="back-link" :to="{ name: 'admin-registro' }">
        No tenés cuenta todavía — registrate
      </router-link>
      <router-link class="back-link" :to="{ name: 'home' }">
        Volver a la reserva de clientes
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.login-eyebrow {
  font-size: 13px;
  color: var(--color-coral);
  margin-bottom: 6px;
}

.login-title {
  font-size: 26px;
  margin-bottom: 24px;
}

.back-link {
  display: block;
  text-align: center;
  margin-top: 16px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-decoration: none;
}
</style>
