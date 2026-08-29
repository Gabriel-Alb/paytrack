<template>
    <nav class="shrink-0 border-b border-black/[0.06] bg-white px-4" aria-label="Filtrar notificações">
        <div class="flex items-center gap-5" role="tablist">
            <button v-for="filter in filters" :key="filter.value" type="button" role="tab"
                :aria-selected="modelValue === filter.value" :class="[
                    'relative py-3 text-[12px] font-medium transition-colors',
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