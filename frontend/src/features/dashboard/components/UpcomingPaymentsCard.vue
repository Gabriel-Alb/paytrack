<template>
    <article class="min-w-0 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
        <header class="flex items-center justify-between gap-2">
            <h2 class="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-[15px]">
                {{ title }}
            </h2>

            <slot name="header-action" />
        </header>

        <div v-if="items.length" class="mt-4 divide-y divide-black/[0.06]">
            <button v-for="(payment, index) in items" :key="payment.id ?? `${payment.name}-${index}`" type="button"
                class="group relative flex w-full touch-manipulation items-center gap-2 rounded-lg py-3 text-left outline-none transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:-translate-y-px hover:bg-black/[0.012] hover:shadow-[0_3px_10px_rgba(0,0,0,0.025)] active:translate-y-0 active:bg-black/[0.02] active:shadow-none focus-visible:bg-black/[0.02]"
                @click="handleClick(payment)">
                <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeedff] text-[9px] font-semibold text-[#5b5790] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-px group-active:translate-y-0 sm:h-9 sm:w-9 sm:text-[10px]">
                    {{ payment.initials }}
                </div>

                <div
                    class="min-w-0 flex-1 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-px group-active:translate-x-0">
                    <p class="truncate text-[10px] font-semibold text-[#3f3f46] sm:text-xs">
                        {{ payment.name }}
                    </p>

                    <p class="mt-0.5 truncate text-[8px] text-[#a1a1aa] sm:text-[10px]">
                        {{ payment.date }}
                    </p>
                </div>

                <svg viewBox="0 0 24 24"
                    class="h-4 w-4 shrink-0 text-[#a1a1aa] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-active:translate-x-0"
                    aria-hidden="true">
                    <path :d="mdiChevronRight" fill="currentColor" />
                </svg>
            </button>
        </div>

        <div v-else class="flex min-h-[120px] items-center justify-center text-center">
            <p class="text-[10px] text-[#a1a1aa] sm:text-[11px]">
                {{ emptyText }}
            </p>
        </div>
    </article>
</template>

<script setup>
import { mdiChevronRight } from '@mdi/js'

defineProps({
    title: {
        type: String,
        default: 'Próximos pagamentos',
    },
    items: {
        type: Array,
        required: true,
    },
    emptyText: {
        type: String,
        default: 'Nenhum pagamento próximo.',
    },
})

const emit = defineEmits(['select'])

const handleClick = (payment) => {
    emit('select', payment)
}
</script>