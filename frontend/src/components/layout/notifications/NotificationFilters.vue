<template>
    <nav class="min-w-0 shrink-0 border-b border-black/[0.06] bg-white px-3 sm:px-4" aria-label="Filtrar notificações">
        <div class="grid grid-cols-3 gap-1" role="tablist">
            <button v-for="filter in filters" :key="filter.value" type="button" role="tab"
                :aria-selected="modelValue === filter.value" :class="[
                    'relative min-h-11 min-w-0 px-1 py-3 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#166534]',
                    modelValue === filter.value
                        ? 'text-[#18181b]'
                        : 'text-[#a1a1aa] hover:text-[#52525b]',
                ]" @click="selectFilter(filter.value)">
                {{ filter.label }}

                <span v-if="modelValue === filter.value"
                    class="absolute right-0 bottom-0 left-0 h-[2px] rounded-full bg-[#18181b]" />
            </button>
        </div>
    </nav>
</template>

<script setup>
defineProps({
    modelValue: {
        type: String,
        required: true,
    },
    filters: {
        type: Array,
        required: true,
    },
})

const emit = defineEmits(['update:modelValue'])

const selectFilter = (filter) => {
    emit('update:modelValue', filter)
}
</script>
