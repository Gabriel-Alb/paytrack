import { toast } from '@/composables/useToast'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { currentDate, getMonthlyReport } from '@/services/paytrack'

export const reportStatuses = [
  { key: 'on-time', label: 'Em dia', color: '#166534' },
  { key: 'attention', label: 'Pequeno atraso', color: '#d99732' },
  { key: 'overdue', label: 'Atrasado', color: '#c24141' },
]

export const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, index, 1))).replace(/^./, (letter) => letter.toUpperCase()),
}))

export function formatReportDate(value, options = { day: '2-digit', month: '2-digit' }) {
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

export function useMonthlyReport() {
  const today = currentDate()
  const year = Number(today.slice(0, 4))
  const selectedMonth = ref(Number(today.slice(5, 7)))
  const selectedWeek = ref(0)
  const selectedDay = ref(today)
  const selectedStatus = ref('on-time')
  const data = ref(null)
  const loading = ref(false)
  let controller
  let generation = 0

  const period = computed(() => {
    const prefix = `${year}-${String(selectedMonth.value).padStart(2, '0')}`
    const count = new Date(Date.UTC(year, selectedMonth.value, 0)).getUTCDate()
    return { start: `${prefix}-01`, end: `${prefix}-${count}` }
  })
  const days = computed(() => {
    const count = Number(period.value.end.slice(8))
    const agenda = new Map((data.value?.agenda ?? []).map((day) => [day.date, day]))
    return Array.from({ length: count }, (_, index) => {
      const date = `${period.value.start.slice(0, 8)}${String(index + 1).padStart(2, '0')}`
      return { date, day: index + 1, summary: agenda.get(date) }
    })
  })
  const weeks = computed(() => {
    const groups = []
    for (const day of days.value) {
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay()
      if (!groups.length || weekday === 1) groups.push([])
      groups.at(-1).push(day)
    }
    return groups
  })
  const week = computed(() => weeks.value[selectedWeek.value] ?? [])
  const chartItems = computed(() => {
    const receipts = new Map((data.value?.receiptDays ?? []).map((day) => [day.date, Number(day.value)]))
    return week.value.map((day) => ({
      id: day.date, label: formatReportDate(day.date, { weekday: 'short', day: '2-digit' }),
      fullLabel: formatReportDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' }),
      value: receipts.get(day.date) ?? 0,
    }))
  })
  const distribution = computed(() => {
    const counts = new Map(reportStatuses.map((status) => [status.key, 0]))
    for (const contract of data.value?.contractStatuses ?? []) {
      counts.set(contract.status, counts.get(contract.status) + 1)
    }
    return reportStatuses.map((status) => ({ ...status, count: counts.get(status.key) }))
  })
  const filteredContracts = computed(() => (data.value?.contractStatuses ?? [])
    .filter((contract) => contract.status === selectedStatus.value))
  const daySummary = computed(() => days.value.find((day) => day.date === selectedDay.value)?.summary)
  const calendarOffset = computed(() => (new Date(`${period.value.start}T00:00:00Z`).getUTCDay() + 6) % 7)

  async function reload() {
    controller?.abort()
    controller = new AbortController()
    const requestGeneration = ++generation
    loading.value = true
    data.value = null
    try {
      const result = await getMonthlyReport(period.value, controller.signal)
      if (generation === requestGeneration) data.value = result
    } catch (cause) {
      if (generation === requestGeneration && cause.name !== 'AbortError') {
        toast.error(cause.message || 'Não foi possível carregar o relatório.', { action: { label: 'Tentar novamente', run: reload } })
      }
    } finally {
      if (generation === requestGeneration) loading.value = false
    }
  }

  watch(period, () => {
    selectedDay.value = today >= period.value.start && today <= period.value.end ? today : period.value.start
    selectedWeek.value = Math.max(0, weeks.value.findIndex((group) => group.some((day) => day.date === selectedDay.value)))
    reload()
  }, { immediate: true })
  onBeforeUnmount(() => { generation++; controller?.abort() })

  return {
    selectedMonth, selectedWeek, selectedDay, selectedStatus, data, loading, reload,
    weeks, week, days, chartItems, distribution, filteredContracts, daySummary, calendarOffset,
  }
}
