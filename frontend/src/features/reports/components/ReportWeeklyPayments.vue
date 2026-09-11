<template>
  <BaseBarChart class="report-weekly" compact title="Pagamentos semanais" :items="items" :height="175"
    :description="description" :value-formatter="formatCurrency" series-name="Recebido">
    <template #header-action>
      <div class="report-week-switch" aria-label="Semana do mês">
        <button type="button" :disabled="modelValue === 0" aria-label="Semana anterior"
          @click="$emit('update:modelValue', modelValue - 1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiChevronLeft" fill="currentColor" /></svg>
        </button>
        <span aria-live="polite">Semana {{ modelValue + 1 }} de {{ weekCount }}</span>
        <button type="button" :disabled="modelValue >= weekCount - 1" aria-label="Próxima semana"
          @click="$emit('update:modelValue', modelValue + 1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiChevronRight" fill="currentColor" /></svg>
        </button>
      </div>
    </template>
  </BaseBarChart>
</template>

<script setup>
import { computed } from 'vue'
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import BaseBarChart from '@/components/base/BaseBarChart.vue'
import { formatCurrency } from '@/services/paytrack'
import { formatReportDate } from '../composables/useMonthlyReport'

const props = defineProps({ modelValue: Number, weekCount: Number, items: { type: Array, default: () => [] }, loading: Boolean, available: Boolean })
defineEmits(['update:modelValue'])
const description = computed(() => {
  if (props.loading) return 'Carregando recebimentos…'
  if (!props.available) return 'Recebimentos indisponíveis.'
  if (!props.items.some((item) => item.value > 0)) return 'Nenhum pagamento registrado nesta semana'
  const total = props.items.reduce((sum, item) => sum + item.value, 0)
  return `${formatReportDate(props.items[0].id)} – ${formatReportDate(props.items.at(-1).id)} · ${formatCurrency(total)} recebido`
})
</script>
