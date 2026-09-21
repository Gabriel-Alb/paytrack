<template>
  <article class="report-card report-distribution">
    <header class="report-card-header mb-5"><h2>Distribuição dos contratos</h2></header>

    <div class="report-gauge">
      <svg viewBox="0 0 240 134" aria-label="Distribuição por situação" role="group">
        <path d="M 24 116 A 96 96 0 0 1 216 116" fill="none" stroke="#eaeaed" stroke-width="29" />
        <path v-for="segment in segments" :key="segment.key" :d="segment.path" fill="none"
          :stroke="segment.color" stroke-width="29" role="button" tabindex="0"
          :aria-label="`${segment.label}: ${segment.count} contratos`" :aria-pressed="modelValue === segment.key"
          class="!outline-none focus-visible:[stroke-width:34]" :class="{ 'is-selected': modelValue === segment.key }"
          @click="$emit('update:modelValue', segment.key)" @keydown.enter="$emit('update:modelValue', segment.key)"
          @keydown.space.prevent="$emit('update:modelValue', segment.key)">
          <title>{{ segment.label }}: {{ segment.count }} contratos</title>
        </path>
      </svg>
      <div class="report-gauge-total"><strong>{{ available ? total : '—' }}</strong><span>contratos analisados</span></div>
    </div>
    <div class="report-distribution-legend" role="group" aria-label="Filtrar lista por situação">
      <button v-for="status in items" :key="status.key" type="button" :aria-pressed="modelValue === status.key"
        class="!outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-inset"
        :style="{ '--status-color': status.color }" @click="$emit('update:modelValue', status.key)">
        <span class="report-legend-label"><span class="report-status-dot" />{{ status.label }}</span>
        <strong>{{ available ? status.count : '—' }}</strong>
      </button>
    </div>
    <p v-if="!total" class="report-caption report-distribution-empty" role="status">
      {{ loading ? 'Carregando distribuição…' : available ? 'Nenhum contrato com vencimento neste mês' : 'Distribuição indisponível.' }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ modelValue: String, items: { type: Array, default: () => [] }, loading: Boolean, available: Boolean })
defineEmits(['update:modelValue'])
const total = computed(() => props.items.reduce((sum, item) => sum + item.count, 0))
const segments = computed(() => {
  let offset = 0
  return props.items.filter((item) => item.count > 0).map((item) => {
    const angle = item.count / total.value * Math.PI
    const gap = Math.min(0.025, angle / 5)
    const start = Math.PI + offset + gap / 2
    const end = Math.PI + offset + angle - gap / 2
    offset += angle
    const point = (value) => `${120 + 96 * Math.cos(value)} ${116 + 96 * Math.sin(value)}`
    return { ...item, path: `M ${point(start)} A 96 96 0 0 1 ${point(end)}` }
  })
})
</script>
