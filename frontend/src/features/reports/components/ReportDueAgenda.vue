<template>
  <article class="report-card report-agenda">
    <header class="report-card-header">
      <h2 class="text-[13px] font-semibold text-[#27272a]">
        Agenda de vencimentos
      </h2>
    </header>

    <div class="report-agenda-content">
      <div class="report-calendar min-w-0 flex-1" role="group" aria-label="Dias do mês analisado">
        <span v-for="day in weekdays" :key="day" class="report-weekday" aria-hidden="true">
          {{ day }}
        </span>

        <span v-for="blank in offset" :key="`blank-${blank}`" aria-hidden="true" />

        <button v-for="day in days" :key="day.date" type="button" :aria-pressed="modelValue === day.date"
          :aria-current="day.date === today ? 'date' : undefined" :aria-label="dayLabel(day)"
          :class="{ 'has-dues': day.summary }" @click="$emit('update:modelValue', day.date)">
          {{ day.day }}

          <span v-if="day.summary" class="report-calendar-dot" :style="{ backgroundColor: colors[day.summary.status] }"
            aria-hidden="true" />
        </button>
      </div>

      <div class="report-day-summary shrink-0 pl-5" aria-live="polite">
        <template v-if="summary">
          <p class="mb-2 text-[10px] text-[#71717a]">
            {{ summary.count }}
            {{ summary.count === 1 ? 'vencimento' : 'vencimentos' }}
          </p>

          <dl class="report-day-values">
            <div>
              <dt>Previsto</dt>
              <dd>{{ formatCurrency(summary.expected) }}</dd>
            </div>

            <div>
              <dt>Recebido</dt>
              <dd>{{ formatCurrency(summary.received) }}</dd>
            </div>
          </dl>
        </template>

        <p v-else class="report-caption report-day-empty">
          {{
            loading
              ? 'Carregando vencimentos…'
              : available
                ? 'Nenhum vencimento neste dia'
                : 'Vencimentos indisponíveis.'
          }}
        </p>
      </div>
    </div>

    <div class="flex items-center justify-center gap-5 border-t border-black/[0.07] px-4 py-3"
      aria-label="Legenda dos vencimentos">
      <div v-for="status in legendStatuses" :key="status.key" class="flex items-center gap-1.5 whitespace-nowrap">
        <span class="block h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: status.color }"
          aria-hidden="true" />

        <span class="text-[9px] font-medium text-[#71717a]">
          {{ status.label }}
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { currentDate, formatCurrency } from '@/services/paytrack'
import {
  formatReportDate,
  reportStatuses,
} from '../composables/useMonthlyReport'

defineProps({
  modelValue: String,
  days: Array,
  offset: Number,
  summary: Object,
  loading: Boolean,
  available: Boolean,
})

defineEmits(['update:modelValue'])

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const today = currentDate()

const colors = {
  ...Object.fromEntries(
    reportStatuses.map((status) => [status.key, status.color]),
  ),
  pending: '#a1a1aa',
}

const legendStatuses = [
  {
    key: 'pending',
    label: 'Pendente futuro',
    color: colors.pending,
  },
  ...reportStatuses.map((status) => ({
    key: status.key,
    label: status.label,
    color: status.color,
  })),
]

function dayLabel(day) {
  const label = formatReportDate(day.date, {
    day: 'numeric',
    month: 'long',
  })

  if (!day.summary) {
    return `${label}, nenhum vencimento`
  }

  const status =
    reportStatuses.find((item) => item.key === day.summary.status)?.label ??
    'Pendente futuro'

  return `${label}, ${day.summary.count} vencimentos, ${status}, ${formatCurrency(day.summary.expected)} previsto`
}
</script>