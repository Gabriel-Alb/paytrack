<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <section class="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard v-for="card in summaryCards" :key="card.title" v-bind="card" />
        </section>

        <BaseBarChart class="mt-4 sm:mt-5" title="Recebimentos" description="Valores recebidos nos últimos sete dias"
            badge="Esta semana" series-name="Recebimentos" :items="receiptChart" :value-formatter="formatCurrency" />

        <section class="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
            <PortfolioSummaryCard title="Resumo da carteira" :items="portfolioSummary" />

            <UpcomingPaymentsCard title="Próximos pagamentos" :items="upcomingPayments" @select="handlePaymentSelect" />
        </section>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseBarChart from '@/components/base/BaseBarChart.vue'
import PortfolioSummaryCard from '../components/PortfolioSummaryCard.vue'
import SummaryCard from '../components/SummaryCard.vue'
import UpcomingPaymentsCard from '../components/UpcomingPaymentsCard.vue'
import { getDashboard, formatCurrency, fromCents } from '@/services/paytrack'
import { perform } from '@/services/api'

const router = useRouter()
const dashboard = ref(null)
onMounted(() =>
  perform(async () => {
    dashboard.value = await getDashboard()
  }),
)
const indicator = (value) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, signDisplay: 'always' }).format(
        value,
      ) + '%'
const summaryCards = computed(() => [
  {
    title: 'Carteira ativa',
    value: formatCurrency(fromCents(dashboard.value?.portfolio ?? 0)),
    description: (dashboard.value?.active_loans ?? 0) + ' empréstimos ativos',
    indicator: indicator(dashboard.value?.portfolio_change),
    status: dashboard.value?.portfolio_change < 0 ? 'negative' : 'positive',
  },
  {
    title: 'Recebido no mês',
    value: formatCurrency(fromCents(dashboard.value?.received ?? 0)),
    description: (dashboard.value?.payment_count ?? 0) + ' pagamentos confirmados',
    indicator: indicator(dashboard.value?.received_change),
    status: dashboard.value?.received_change < 0 ? 'negative' : 'positive',
  },
])
const receiptChart = computed(() =>
  (dashboard.value?.receipt_chart ?? []).map((item) => ({
    id: item.date,
    label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(item.date),
    ),
    fullLabel: new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(item.date)),
    value: Number(fromCents(item.value)),
  })),
)
const portfolioSummary = computed(() =>
  [
    { label: 'Em dia', key: 'regular', color: 'bg-[#65a30d]' },
    { label: 'Atrasados', key: 'attention', color: 'bg-[#f59e0b]' },
    { label: 'Inadimplentes', key: 'overdue', color: 'bg-[#b91c1c]' },
  ].map((item) => {
    const status = dashboard.value?.portfolio_status
    const percentage = status?.total ? (status[item.key] / status.total) * 100 : 0
    return {
      ...item,
      percentage,
      value: new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(percentage) + '%',
    }
  }),
)
const upcomingPayments = computed(() =>
  (dashboard.value?.upcoming ?? []).map((item) => ({
    ...item,
    initials: item.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join(''),
    date:
      item.due_date === dashboard.value.today
        ? 'Hoje'
        : new Intl.DateTimeFormat('pt-BR', {
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }).format(new Date(item.due_date)),
  })),
)
const handlePaymentSelect = (payment) =>
  router.push({ name: 'loans', query: { loan: payment.loan_id } })
</script>
