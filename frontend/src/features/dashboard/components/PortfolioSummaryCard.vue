<template>
    <article
        class="relative min-w-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5">
        <div
            class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#166534]/20 to-transparent" />

        <header class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <h2 class="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-[15px]">
                    {{ title }}
                </h2>

                <p v-if="description" class="mt-1 text-[9px] leading-relaxed text-[#a1a1aa] sm:text-[11px]">
                    {{ description }}
                </p>
            </div>

            <div v-if="$slots['header-action']" class="shrink-0">
                <slot name="header-action" />
            </div>
        </header>

        <div v-if="normalizedItems.length" class="mt-5 space-y-5">
            <div v-for="(item, index) in normalizedItems" :key="item.key" class="group">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-2">


                        <span
                            class="truncate text-[9px] font-medium text-[#71717a] transition-colors duration-200 group-hover:text-[#52525b] sm:text-[11px]">
                            {{ item.label }}
                        </span>
                    </div>

                    <span
                        class="shrink-0 text-[10px] font-semibold tracking-[-0.01em] text-[#3f3f46] tabular-nums sm:text-[12px]">
                        {{ item.value }}
                    </span>
                </div>

                <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-[#f1f1f2]" role="progressbar"
                    :aria-label="item.label" :aria-valuenow="item.percentage" aria-valuemin="0" aria-valuemax="100">
                    <div :class="[
                        'h-full rounded-full transition-[width] duration-700 ease-out',
                        item.color,
                    ]" :style="{
                            width: isReady
                                ? `${item.percentage}%`
                                : '0%',
                            transitionDelay: `${index * 70}ms`,
                        }" />
                </div>
            </div>
        </div>

        <div v-else
            class="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-black/[0.08] bg-[#fafafa]">
            <span class="text-[10px] font-medium text-[#a1a1aa] sm:text-xs">
                Nenhum dado disponível
            </span>
        </div>
    </article>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
    title: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        default: '',
    },
    items: {
        type: Array,
        required: true,
    },
})

const isReady = ref(false)

const normalizePercentage = (percentage) => {
    const value = Number(percentage)

    if (Number.isNaN(value)) {
        return 0
    }

    return Math.min(Math.max(value, 0), 100)
}

const normalizedItems = computed(() =>
    props.items.map((item, index) => ({
        ...item,
        key: item.id ?? `${item.label}-${index}`,
        percentage: normalizePercentage(item.percentage),
        color: item.color || 'bg-[#166534]',
    })),
)

onMounted(() => {
    requestAnimationFrame(() => {
        isReady.value = true
    })
})
</script>