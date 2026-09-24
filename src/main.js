import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initAuth } from './store/auth'
import './assets/styles/main.scss'

initAuth().finally(() => {
  createApp(App).use(router).mount('#app')
})
