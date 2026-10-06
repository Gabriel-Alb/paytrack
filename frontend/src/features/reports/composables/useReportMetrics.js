import { onBeforeUnmount, ref, watch } from 'vue'
import { request } from '@/services/api'
import { getReportMetrics } from '@/services/paytrack'
import { toast } from '@/composables/useToast'

export function useReportMetrics(period) {
  const selectedCompany = ref(null)
  const companies = ref([])
  const companiesLoading = ref(false)
  const metrics = ref(null)
  const metricsLoading = ref(false)
  const companiesController = new AbortController()
  let controller
  let generation = 0

  async function loadCompanies() {
    companiesLoading.value = true
    try {
      companies.value = await request('/companies', { signal: companiesController.signal })
    } catch (cause) {
      if (cause.name !== 'AbortError') toast.error(cause, { action: { label: 'Tentar novamente', run: loadCompanies } })
    } finally {
      companiesLoading.value = false
    }
  }

  async function reloadMetrics() {
    controller?.abort()
    controller = new AbortController()
    const requestGeneration = ++generation
    metrics.value = null
    metricsLoading.value = true
    try {
      const result = await getReportMetrics({
        ...period.value, company_id: selectedCompany.value ?? undefined,
      }, controller.signal)
      if (generation === requestGeneration) metrics.value = result
    } catch (cause) {
      if (generation === requestGeneration && cause.name !== 'AbortError') {
        toast.error(cause, { action: { label: 'Tentar novamente', run: reloadMetrics } })
      }
    } finally {
      if (generation === requestGeneration) metricsLoading.value = false
    }
  }

  loadCompanies()
  watch([period, selectedCompany], reloadMetrics, { immediate: true })
  onBeforeUnmount(() => {
    generation++
    controller?.abort()
    companiesController.abort()
  })

  return { selectedCompany, companies, companiesLoading, metrics, metricsLoading }
}
