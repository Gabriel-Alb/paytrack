<template>
    <article class="min-w-0 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
        <header class="flex items-center justify-between gap-2">
            <h2 class="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-[15px]">
                {{ title }}
            </h2>

            <slot name="header-action" />
        </header>

        <div class="mt-5 space-y-4">
            <div v-for="item in items" :key="item.label">
                <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-[9px] font-medium text-[#71717a] sm:text-[11px]">
                        {{ item.label }}
                    </span>

                    <span class="shrink-0 text-[9px] font-semibold text-[#3f3f46] sm:text-[11px]">
                        {{ item.value }}
                    </span>
                </div>

                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0f0f1]" role="progressbar"
                    :aria-label="item.label" :aria-valuenow="normalizePercentage(item.percentage)" aria-valuemin="0"
                    aria-valuemax="100">
                    <div :style="{
                        width: `${normalizePercentage(item.percentage)}%`,
                    }" :class="[
                            'h-full rounded-full transition-[width] duration-500 ease-out',
                            item.color,
                        ]" />
                </div>
            </div>
        </div>
    </article>
</template>

<script setup>
defineProps({
    title: {
        type: String,
        default: 'Resumo',
    },
    items: {
        type: Array,
        required: true,
    },
})

const normalizePercentage = (percentage) => {
    const value = Number(percentage)

    if (Number.isNaN(value)) {
        return 0
    }

    return Math.min(Math.max(value, 0), 100)
}
</script>

