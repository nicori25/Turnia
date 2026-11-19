import { watch } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { authState, initAuth } from '../store/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/client/Home.vue'),
  },
  {
    path: '/reservar',
    name: 'select-service',
    component: () => import('../views/client/SelectService.vue'),
  },
  {
    path: '/confirmar',
    name: 'confirm-data',
    component: () => import('../views/client/ConfirmData.vue'),
  },
  {
    path: '/confirmacion',
    name: 'confirmation',
    component: () => import('../views/client/Confirmation.vue'),
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('../views/admin/Login.vue'),
  },
  {
    path: '/admin/registro',
    name: 'admin-registro',
    component: () => import('../views/admin/Register.vue'),
  },
  {
    path: '/admin/panel',
    name: 'admin-panel',
    component: () => import('../views/admin/Panel.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/turno/:id',
    name: 'admin-turno-detalle',
    component: () => import('../views/admin/TurnoDetail.vue'),
    props: true,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: import.meta.env.VITE_ROUTER_MODE === 'hash'
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Las pantallas del panel del barbero requieren sesión activa en Supabase.
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) await initAuth()
  if (to.meta.requiresAuth && !authState.user) {
    return { name: 'admin-login' }
  }
})

watch(() => authState.user, (user) => {
  if (authState.ready && !user && router.currentRoute.value.meta.requiresAuth) {
    router.replace({ name: 'admin-login' })
  }
})

export default router
