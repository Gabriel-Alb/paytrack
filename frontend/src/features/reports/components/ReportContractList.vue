<template>
  <article class="report-card report-contracts" :class="[
    { 'report-payments': payments },
    payments
      ? '!h-full !min-h-full !max-h-full overflow-hidden'
      : '',
  ]" :aria-label="title">
    <header class="report-card-header">
      <h2>{{ title }}</h2>
    </header>

    <template v-if="payments">

      <div class="report-status-filter" role="group" aria-label="Situação dos contratos">
        <button v-for="status in reportStatuses" :key="status.key" type="button"
          :aria-pressed="modelValue === status.key" :style="{ '--status-color': status.color }"
          @click="$emit('update:modelValue', status.key)">
          <span class="report-status-dot" />
          {{ status.label }}
        </button>
      </div>
    </template>

    <div :class="[
      'report-list-scroll overflow-x-hidden pr-2 [scrollbar-gutter:stable]',
      payments
        ? '!h-[calc(100%-96px)] !min-h-0 !max-h-[calc(100%-16px)] overflow-y-auto'
        : 'overflow-y-auto',
    ]" tabindex="0" :aria-label="title">
      <ul v-if="items.length" class="report-list">
        <li v-for="contract in items" :key="contract.id">
          <div class="report-list-line">
            <p class="report-client" :title="contract.client">
              {{ contract.client }}
            </p>

            <strong class="shrink-0" :title="payments ? 'Valor previsto no mês' : 'Capital liberado'">
              {{
                formatCurrency(
                  payments
                    ? contract.expected
                    : contract.amount,
                )
              }}
            </strong>
          </div>

          <div class="report-list-line report-caption">
            <span>
              Contrato #{{ contract.id }}
            </span>

            <time :datetime="contract.date">
              {{ formatReportDate(contract.date) }}
            </time>
          </div>

          <div v-if="payments" class="report-list-line report-caption">
            <span>
              Parcela
              {{ contract.installmentNumber }}/{{ contract.installmentCount }}
            </span>

            <span v-if="contract.daysLate" :style="{ color: activeStatus.color }">
              {{ contract.daysLate }} dias de atraso
            </span>

            <span v-else-if="Number(contract.pending) > 0">
              {{ formatCurrency(contract.pending) }} pendente
            </span>

            <span v-else class="report-paid">
              Pago
            </span>
          </div>
        </li>
      </ul>

      <p v-else class="report-empty" role="status">
        {{
          loading
            ? 'Carregando contratos…'
            : !available
              ? 'Contratos indisponíveis.'
              : payments
                ? 'Nenhum contrato nesta situação'
                : 'Nenhum contrato neste mês'
        }}
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency } from '@/services/paytrack'
import {
  formatReportDate,
  reportStatuses,
} from '../composables/useMonthlyReport'

const props = defineProps({
  title: String,
  items: {
    type: Array,
    default: () => [],
  },
  total: Number,
  payments: Boolean,
  modelValue: String,
  loading: Boolean,
  available: Boolean,
})

defineEmits(['update:modelValue'])

const activeStatus = computed(
  () =>
    reportStatuses.find(
      (status) => status.key === props.modelValue,
    ) ?? reportStatuses[0],
)
</script>