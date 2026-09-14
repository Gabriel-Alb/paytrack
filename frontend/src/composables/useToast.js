import { readonly, ref } from 'vue'

const items = ref([])
const waiting = []
const timers = new Map()
const paused = new Map()
let sequence = 0
let limit = 3
let suspended = false
const durations = { success: 5000, error: 8000, warning: 7000, info: 5000 }

function start(item) {
  if (suspended || paused.get(item.id)?.size || timers.has(item.id)) return
  const started = Date.now()
  const timer = setTimeout(() => dismiss(item.id), item.remaining)
  timer.unref?.()
  timers.set(item.id, { timer, started })
}

function stop(item) {
  const running = timers.get(item.id)
  if (!running) return
  clearTimeout(running.timer)
  item.remaining = Math.max(0, item.remaining - (Date.now() - running.started))
  timers.delete(item.id)
}

function fill() {
  while (items.value.length < limit && waiting.length) items.value.push(waiting.shift())
  items.value.forEach(start)
}

function dismiss(id) {
  const item = items.value.find(item => item.id === id)
  if (item) stop(item)
  paused.delete(id)
  items.value = items.value.filter(item => item.id !== id)
  const index = waiting.findIndex(item => item.id === id)
  if (index >= 0) waiting.splice(index, 1)
  fill()
}

function show(type, value, options = {}) {
  if (value?.name === 'AbortError') return
  const message = String(value instanceof Error ? value.message : value || 'Não foi possível concluir a operação.')
  const duplicate = [...items.value, ...waiting].find(item => item.type === type && item.message === message)
  if (duplicate) return duplicate.id
  const item = {
    id: ++sequence, type, message,
    remaining: durations[type],
    action: options.action,
  }
  waiting.push(item)
  fill()
  return item.id
}

export const toast = Object.fromEntries(Object.keys(durations).map(type => [type, (message, options) => show(type, message, options)]))
toast.dismiss = dismiss
toast.clear = () => {
  items.value.forEach(stop)
  items.value = []
  waiting.length = 0
  paused.clear()
}

export function useToast() {
  return {
    toast, items: readonly(items), dismiss,
    setLimit(value) {
      limit = Math.max(1, value)
      const overflow = items.value.splice(limit)
      overflow.forEach(item => { stop(item); paused.delete(item.id) })
      waiting.unshift(...overflow)
      fill()
    },
    suspend(value) {
      suspended = value
      items.value.forEach(value ? stop : start)
    },
    pause(id, reason, value) {
      const item = items.value.find(item => item.id === id)
      if (!item) return
      const reasons = paused.get(id) || new Set()
      if (value) reasons.add(reason)
      else reasons.delete(reason)
      paused.set(id, reasons)
      if (reasons.size) stop(item)
      else start(item)
    },
  }
}
