<template>
    <article
        class="rounded-2xl border border-black/[0.07] bg-white p-5 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-[12px] font-medium text-[#71717a]">
                    {{ title }}
                </p>

                <p class="mt-3 text-[25px] font-semibold tracking-[-0.03em] text-[#18181b]">
                    {{ value }}
                </p>
            </div>

            <div v-if="indicator" :class="[
                'rounded-lg px-2 py-1 text-[10px] font-semibold',
                indicatorClass,
            ]">
                {{ indicator }}
            </div>
        </div>

        <p v-if="description" class="mt-3 text-[11px] leading-5 text-[#a1a1aa]">
            {{ description }}
        </p>
    </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    title: {
        type: String,
        required: true,
    },

    value: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: '',
    },

    indicator: {
        type: String,
        default: '',
    },

    status: {
        type: String,
        default: 'neutral',
    },
})

const indicatorClass = computed(() => {
    const classes = {
        positive: 'bg-[#f0fdf4] text-[#15803d]',
        warning: 'bg-[#fffbeb] text-[#b45309]',
        danger: 'bg-[#fef2f2] text-[#b91c1c]',
        neutral: 'bg-[#f4f4f5] text-[#71717a]',
    }

    return classes[props.status] || classes.neutral
})
</script>