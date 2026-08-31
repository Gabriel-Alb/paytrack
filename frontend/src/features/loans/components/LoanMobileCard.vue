<template>
    <article class="rounded-xl border border-black/[0.07] bg-white p-4">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-[#202124]">
                    {{ loan.clientName }}
                </h3>

                <p class="mt-1 text-xs text-black/40">
                    Empréstimo #{{ loan.id }}
                </p>
            </div>

            <LoanStatusBadge :status="loan.status" />
        </div>

        <div class="mt-4">
            <p class="text-xs text-black/40">
                Valor emprestado
            </p>

            <p class="mt-0.5 text-lg font-semibold tracking-tight text-[#202124]">
                {{ formatCurrency(loan.amount) }}
            </p>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-black/[0.05] pt-4">
            <div>
                <p class="text-xs text-black/40">
                    Parcelas
                </p>

                <p class="mt-1 text-sm font-medium text-[#202124]">
                    {{ loan.installmentCount }}x de
                    {{ formatCurrency(loan.installmentValue) }}
                </p>
            </div>

            <div>
                <p class="text-xs text-black/40">
                    Juros
                </p>

                <p class="mt-1 text-sm font-medium text-[#202124]">
                    {{ loan.interest }}%
                </p>
            </div>

            <div>
                <p class="text-xs text-black/40">
                    Parcelas pagas
                </p>

                <p class="mt-1 text-sm font-medium text-[#202124]">
                    {{ loan.paidInstallments }}/{{ loan.installmentCount }}
                </p>
            </div>

            <div>
                <p class="text-xs text-black/40">
                    Progresso
                </p>

                <p class="mt-1 text-sm font-medium text-[#166534]">
                    {{ progress }}%
                </p>
            </div>
        </div>

        <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
            <div class="h-full rounded-full bg-[#166534] transition-all duration-300"
                :style="{ width: `${progress}%` }" />
        </div>
    </article>
</template>

<script setup>
import { computed } from 'vue'
import LoanStatusBadge from './LoanStatusBadge.vue'

const props = defineProps({
    loan: {
        type: Object,
        required: true
    }
})

const progress = computed(() => {
    if (!props.loan.installmentCount) {
        return 0
    }

    return Math.round(
        (props.loan.paidInstallments / props.loan.installmentCount) * 100
    )
})

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
</script>