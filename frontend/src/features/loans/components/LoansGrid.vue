<template>
    <section>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <div class="relative w-full sm:max-w-[360px]">
                    <input v-model="search" type="search" placeholder="Pesquisar por cliente"
                        class="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-4 pr-10 text-[13px] text-[#27272a] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#a1a1aa] focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]" />

                    <span
                        class="mdi mdi-magnify pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#a1a1aa]"
                        aria-hidden="true" />
                </div>

                <div class="relative w-full sm:w-[180px]">
                    <select v-model="statusFilter"
                        class="h-10 w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-3 pr-9 text-[13px] font-medium text-[#52525b] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]">
                        <option value="todos">
                            Todos os status
                        </option>

                        <option value="on-time">
                            Em dia
                        </option>

                        <option value="attention">
                            Pequeno atraso
                        </option>

                        <option value="overdue">
                            Atrasado
                        </option>
                    </select>

                    <span
                        class="mdi mdi-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#71717a]"
                        aria-hidden="true" />
                </div>
            </div>

            <div class="w-full shrink-0 sm:w-auto">
                <slot name="toolbar-action" />
            </div>
        </div>

        <div v-if="filteredLoans.length" class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LoanCard v-for="loan in filteredLoans" :key="loan.id" :loan="loan" @open="openLoan(loan)" />
        </div>

        <div v-else
            class="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.09] bg-white px-6 text-center">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#71717a]">
                <span class="mdi mdi-cash-search text-[22px]" aria-hidden="true" />
            </div>

            <h3 class="mt-4 text-sm font-semibold text-[#27272a]">
                Nenhum empréstimo encontrado
            </h3>

            <p class="mt-1 max-w-sm text-xs leading-5 text-[#8b8b93]">
                Tente alterar os filtros ou
                pesquisar utilizando outro cliente.
            </p>
        </div>
    </section>
</template>

<script setup>
import {
    computed,
    ref,
} from 'vue'

import LoanCard from '@/features/loans/components/LoanCard.vue'

const props = defineProps({
    loans: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits([
    'open-loan',
])

const search = ref('')
const statusFilter = ref('todos')

const filteredLoans = computed(() => {
    const normalizedSearch =
        search.value
            .trim()
            .toLowerCase()

    return props.loans.filter(
        (loan) => {
            const matchesStatus =
                statusFilter.value ===
                'todos' ||
                loan.status ===
                statusFilter.value

            if (!normalizedSearch) {
                return matchesStatus
            }

            const clientName =
                loan.clientName?.toLowerCase() ??
                ''

            return (
                matchesStatus &&
                clientName.includes(
                    normalizedSearch,
                )
            )
        },
    )
})

function openLoan(loan) {
    emit(
        'open-loan',
        loan,
    )
}
</script>