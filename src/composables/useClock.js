import { onMounted, onUnmounted, ref } from 'vue'

// Refresh availability while a screen remains open, including at midnight.
export function useClock() {
  const now = ref(new Date())
  let timer
  onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 15000) })
  onUnmounted(() => clearInterval(timer))
  return now
}
