<template>
    <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
        :class="statusConfig.classes">


        {{ statusConfig.label }}
    </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    status: {
        type: String,
        required: true
    }
})

const statusConfig = computed(() => {
    const statuses = {
        'on-time': {
            label: 'Em dia',
            classes: 'bg-emerald-50 text-emerald-700',
            dot: 'bg-emerald-500'
        },
        attention: {
            label: 'Atenção',
            classes: 'bg-orange-50 text-orange-700',
            dot: 'bg-orange-500'
        },
        overdue: {
            label: 'Atrasado',
            classes: 'bg-red-50 text-red-700',
            dot: 'bg-red-500'
        }
    }

    return statuses[props.status] ?? statuses['on-time']
})
</script>