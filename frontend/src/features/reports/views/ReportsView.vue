<template>
  <div class="monthly-report" :aria-busy="loading">
    <div class="report-dashboard">
      <div class="report-metrics-row">
        <ReportMetrics
          v-model="selectedMonth"
          :summary="data?.summary"
          :available="!!data"
        />
      </div>

      <div class="report-weekly-row">
        <ReportWeeklyPayments
          v-model="selectedWeek"
          :week-count="weeks.length"
          :items="chartItems"
          :loading="loading"
          :available="!!data"
        />
      </div>

      <div class="report-contracts-panel">
        <ReportContractList
          class="h-full"
          title="Contratos do mês"
          :items="data?.contracts"
          :total="data?.contracts.length ?? 0"
          :loading="loading"
          :available="!!data"
        />
      </div>

      <div class="report-bottom">
        <ReportDueAgenda
          v-model="selectedDay"
          :days="days"
          :offset="calendarOffset"
          :summary="daySummary"
          :loading="loading"
          :available="!!data"
        />

        <ReportStatusDistribution
          :model-value="selectedStatus"
          :items="distribution"
          :loading="loading"
          :available="!!data"
          @update:model-value="selectDistribution"
        />
      </div>

      <div
        ref="paymentsPanel"
        class="report-payments-panel overflow-hidden !outline-none"
        tabindex="-1"
      >
        <ReportContractList
          v-model="selectedStatus"
          class="!h-full !min-h-0 !max-h-full"
          payments
          title="Pagamentos dos contratos"
          :items="filteredContracts"
          :total="filteredContracts.length"
          :loading="loading"
          :available="!!data"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import ReportMetrics from '../components/ReportMetrics.vue'
import ReportWeeklyPayments from '../components/ReportWeeklyPayments.vue'
import ReportContractList from '../components/ReportContractList.vue'
import ReportDueAgenda from '../components/ReportDueAgenda.vue'
import ReportStatusDistribution from '../components/ReportStatusDistribution.vue'
import { useMonthlyReport } from '../composables/useMonthlyReport'
import '../reports.css'

const {
  selectedMonth,
  selectedWeek,
  selectedDay,
  selectedStatus,
  data,
  loading,
  weeks,
  days,
  chartItems,
  distribution,
  filteredContracts,
  daySummary,
  calendarOffset,
} = useMonthlyReport()

const paymentsPanel = ref(null)

async function selectDistribution(status) {
  selectedStatus.value = status

  await nextTick()

  const panel = paymentsPanel.value

  if (!panel) return

  panel.focus({ preventScroll: true })

  const bounds = panel.getBoundingClientRect()

  if (bounds.top < 70 || bounds.bottom > window.innerHeight) {
    panel.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }
}
</script>