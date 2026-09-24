<script setup>
import { useRouter } from 'vue-router'
import { resetBooking } from '../../store/booking'

const router = useRouter()

function startBooking() {
  resetBooking()
  router.push({ name: 'select-service' })
}
</script>

<template>
  <div class="screen screen--client">
    <div class="card home-card">
      <p class="home-card__eyebrow">Martín Barber Studio</p>
      <h1 class="home-card__title">Turnia</h1>
      <p class="home-card__tagline">Agenda sin vueltas para tu barbería.</p>

      <div class="home-card__actions">
        <button class="btn btn--teal" @click="startBooking">Reservar turno</button>
        <router-link class="btn btn--ghost" :to="{ name: 'admin-login' }">
          Soy el barbero
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-card {
  text-align: center;
  padding: 40px 28px;
}

.home-card__eyebrow {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 18px;
}

.home-card__title {
  font-size: 56px;
  color: var(--color-teal);
  line-height: 1;
}

.home-card__tagline {
  margin-top: 10px;
  margin-bottom: 32px;
}

.home-card__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
