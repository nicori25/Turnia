<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../../store/auth'

const router = useRouter()
const businessName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(false)

function canContinue() {
  return (
    businessName.value.trim().length > 1 &&
    email.value.trim().length > 3 &&
    password.value.length >= 6 &&
    password.value === confirmPassword.value
  )
}

async function submit() {
  if (!canContinue() || loading.value) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await register({
      email: email.value,
      password: password.value,
      businessName: businessName.value,
    })
    if (!data.session) {
      // Con la confirmación por email activada, Supabase no abre sesión
      // hasta que el usuario confirma el link que le llega al mail.
      notice.value = 'Te mandamos un mail para confirmar tu cuenta. Confirmalo y después iniciá sesión.'
      return
    }
    router.push({ name: 'admin-panel' })
  } catch (e) {
    error.value = e.message?.includes('already registered')
      ? 'Ese email ya tiene una cuenta.'
      : 'No pudimos crear la cuenta, probá de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="screen screen--client admin-theme">
    <div class="card">
      <p class="login-eyebrow">Turnia · panel del barbero</p>
      <h1 class="login-title">Creá tu cuenta</h1>

      <div class="field">
        <label for="business">Nombre del local</label>
        <input id="business" v-model="businessName" type="text" placeholder="Martín Barber Studio" />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" placeholder="martin@turnia.com" />
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input id="password" v-model="password" type="password" placeholder="Mínimo 6 caracteres" />
      </div>

      <div class="field">
        <label for="confirm">Repetir contraseña</label>
        <input id="confirm" v-model="confirmPassword" type="password" placeholder="••••••••" />
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="notice" class="form-notice">{{ notice }}</p>

      <button class="btn btn--coral" :disabled="!canContinue() || loading" @click="submit">
        {{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}
      </button>

      <router-link class="back-link" :to="{ name: 'admin-login' }">
        Ya tengo cuenta — iniciar sesión
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
