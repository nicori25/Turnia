import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

// Solo actualiza mientras la pantalla está visible (web, Android e iOS).
export function useBusinessClock() {
  const [now, setNow] = useState(() => new Date())
  useFocusEffect(useCallback(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, []))
  return now
}
