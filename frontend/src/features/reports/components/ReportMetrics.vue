<template>
  <section class="report-metrics auto-rows-[64px] !gap-2 lg:!grid-cols-7" aria-label="Resumo mensal">
    <article class="report-card flex h-16 flex-col !px-2 !py-1.5">
      <label for="report-month" class="flex min-h-6 items-center text-[10px] font-medium leading-3 text-zinc-500">
        Mês analisado
      </label>

      <div class="relative mt-1 w-full">
        <select id="report-month" :value="modelValue"
          class="h-[22px] w-full min-w-0 cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white px-1 pr-4 !text-[10px] font-medium text-zinc-700 outline-none transition duration-200 hover:border-zinc-300 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/60"
          @change="$emit('update:modelValue', Number($event.target.value))">
          <option v-for="month in months" :key="month.value" :value="month.value">
            {{ month.label }}
          </option>
        </select>

        <svg viewBox="0 0 24 24" aria-hidden="true"
          class="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500">
          <path :d="mdiChevronDown" fill="currentColor" />
        </svg>
      </div>
    </article>

    <article class="report-card flex h-16 flex-col !px-2 !py-1.5">
      <label for="report-company" class="flex min-h-6 items-center text-[10px] font-medium leading-3 text-zinc-500">
        Empresa
      </label>

      <div class="relative mt-1 w-full">
        <select id="report-company" :value="company ?? ''" :disabled="companiesLoading"
          class="h-[22px] w-full min-w-0 cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white px-1 pr-4 !text-[10px] font-medium text-zinc-700 outline-none transition duration-200 hover:border-zinc-300 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/60"
          @change="$emit('update:company', $event.target.value ? Number($event.target.value) : null)">
          <option value="">Todas as empresas</option>
          <option v-for="item in companies" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>

        <svg viewBox="0 0 24 24" aria-hidden="true"
          class="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500">
          <path :d="mdiChevronDown" fill="currentColor" />
        </svg>
      </div>
    </article>

    <article v-for="metric in metrics" :key="metric.key"
      class="report-card flex h-16 flex-col !px-2 !py-1.5" :title="metric.description">
      <h2 class="flex min-h-6 items-center text-[10px] font-medium leading-3 text-zinc-500">
        {{ metric.label }}
      </h2>

      <p class="mt-1 flex min-h-[22px] items-center text-[13px] font-semibold leading-4 tracking-[-0.01em] [overflow-wrap:anywhere] text-zinc-800 tabular-nums"
        :title="available ? formatCurrency(summary[metric.key]) : undefined">
        {{ available ? formatCurrency(summary[metric.key]) : '—' }}
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
  company: { type: Number, default: null },
  companies: { type: Array, default: () => [] },
  companiesLoading: Boolean,
  summary: {
    type: Object,
    default: () => ({}),
  },
  available: Boolean,
})

defineEmits(['update:modelValue', 'update:company'])

const metrics = [
  {
    key: 'capital',
    label: 'Capital emprestado',
    description: 'Capital liberado nos contratos do período, sem contratos cancelados.',
  },
  {
    key: 'interest',
    label: 'Juros',
    description: 'Juros contratuais dos empréstimos do mês e da empresa selecionados, sem multas.',
  },
  {
    key: 'receivedLateFees',
    label: 'Multas recebidas',
    description: 'Multas efetivamente recebidas dos empréstimos filtrados, excluindo estornos.',
  },
  {
    key: 'received',
    label: 'Valor recebido',
    description: 'Capital, juros e multas já recebidos dos empréstimos filtrados, incluindo pagamentos parciais e excluindo estornos.',
  },
  {
    key: 'pending',
    label: 'Falta receber',
    description: 'Capital e juros contratuais dos empréstimos filtrados menos os pagamentos do contrato, sem descontar multas recebidas.',
  },
]
</script>
