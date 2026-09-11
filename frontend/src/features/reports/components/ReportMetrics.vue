<template>
  <section class="report-metrics" aria-label="Resumo mensal">
    <article class="report-card report-metric report-period !h-[72px] !min-h-0 !px-4 !py-2.5">
      <label for="report-month" class="text-[11px] font-medium leading-none text-zinc-500">
        Mês analisado
      </label>

      <div class="relative mt-2 w-[124px]">
        <select id="report-month" :value="modelValue"
          class="h-7 w-full cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white px-2.5 pr-7 text-[12px] font-medium text-zinc-700 outline-none transition duration-200 hover:border-zinc-300 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/60"
          @change="$emit('update:modelValue', Number($event.target.value))">
          <option v-for="month in months" :key="month.value" :value="month.value">
            {{ month.label }}
          </option>
        </select>

        <svg viewBox="0 0 24 24" aria-hidden="true"
          class="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400">
          <path :d="mdiChevronDown" fill="currentColor" />
        </svg>
      </div>
    </article>

    <article v-for="metric in metrics" :key="metric.key"
      class="report-card report-metric !h-[72px] !min-h-0 !px-4 !py-2.5">
      <h2 class="text-[11px] font-medium leading-none text-zinc-500">
        {{ metric.label }}
      </h2>

      <p class="mt-1.5 text-[16px] font-semibold leading-none tracking-[-0.01em] text-zinc-800"
        :title="available ? formatCurrency(summary[metric.key]) : undefined">
        {{ available ? formatCurrency(summary[metric.key]) : '—' }}
      </p>

      <p v-if="metric.secondary" class="mt-1.5 flex items-center gap-1 text-[10px] leading-none text-zinc-400">
        <span>
          {{ metric.secondary.label }}
        </span>

        <strong class="font-medium text-zinc-600">
          {{
            available
              ? formatCurrency(summary[metric.secondary.key])
              : '—'
          }}
        </strong>
      </p>
    </article>
  </section>
</template>

<script setup>
import { mdiChevronDown } from '@mdi/js'
import { formatCurrency } from '@/services/paytrack'
import { months } from '../composables/useMonthlyReport'

defineProps({
  modelValue: Number,
  summary: {
    type: Object,
    default: () => ({}),
  },
  available: Boolean,
})

defineEmits(['update:modelValue'])

const metrics = [
  {
    key: 'capital',
    label: 'Capital emprestado',
  },
  {
    key: 'received',
    label: 'Total recebido',
    secondary: {
      key: 'pending',
      label: 'Falta receber',
    },
  },
  {
    key: 'expectedProfit',
    label: 'Lucro previsto',
    secondary: {
      key: 'realizedProfit',
      label: 'Recebido',
    },
  },
]
</script>