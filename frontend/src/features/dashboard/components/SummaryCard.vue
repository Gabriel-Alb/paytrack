<template>
    <article
        class="min-w-0 rounded-xl border border-black/[0.07] bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-5"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="text-[11px] font-medium text-[#71717a] sm:text-xs">
                    {{ title }}
                </p>

                <p
                    class="mt-3 truncate text-[20px] font-semibold tracking-[-0.04em] text-[#18181b] sm:text-[24px]"
                >
                    {{ value }}
                </p>
            </div>

        </div>

        <p
            v-if="description"
            class="mt-2 truncate text-[10px] text-[#a1a1aa] sm:text-[11px]"
        >
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