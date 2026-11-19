export const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export function businessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isBookableDate(value, now = new Date()) {
  return isValidDate(value) && value >= businessDate(now)
}

export function isFutureSlot(date, time, now = new Date()) {
  if (!isBookableDate(date, now) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false
  if (date > businessDate(now)) return true
  const currentTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now)
  return time > currentTime
}

export function formatDate(value) {
  if (!isValidDate(value)) return ''
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}
