<template>
    <div role="button" tabindex="0"
        class="rounded-xl outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#166534]/25 active:translate-y-0"
        :aria-label="`Abrir parcelas do empréstimo de ${loan.clientName}`" @click="openLoan"
        @keydown.enter.prevent="openLoan" @keydown.space.prevent="openLoan">
        <BaseInfoCard>
            <div class="flex min-w-0 items-start justify-between gap-4">
                <div class="min-w-0">
                    <h3 class="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#27272a]">
                        {{ loan.clientName }}
                    </h3>

                    <p class="mt-1 text-[12px] text-[#8b8b93]">
                        Empréstimo #{{ loan.id }}
                    </p>
                </div>

                <span class="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]"
                    :class="statusClasses">
                    {{ statusLabel }}
                </span>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                        Valor
                    </p>

                    <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                        {{
                            formatCurrency(
                                loan.amount,
                            )
                        }}
                    </p>
                </div>

                <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                        Valor da parcela
                    </p>

                    <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                        {{
                            formatCurrency(
                                loan.installmentValue,
                            )
                        }}
                    </p>
                </div>

                <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                        Parcelas
                    </p>

                    <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                        {{
                            loan.installmentCount
                        }}
                    </p>
                </div>

                <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                        Juros
                    </p>

                    <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                        {{
                            formatPercentage(
                                loan.interest,
                            )
                        }}
                    </p>
                </div>
            </div>

            <div class="mt-5 flex items-end justify-between gap-4 border-t border-black/[0.06] pt-4">
                <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                        Parcelas pagas
                    </p>

                    <p class="mt-1 text-[12px] font-medium text-[#52525b]">
                        {{ paidInstallmentsLabel }}
                    </p>
                </div>

                <p v-if="loan.daysLate > 0" class="shrink-0 text-[11px] font-medium" :class="loan.status ===
                        'overdue'
                        ? 'text-[#b91c1c]'
                        : 'text-[#b45309]'
                    ">
                    {{ lateDaysLabel }}
                </p>
            </div>
        </BaseInfoCard>
    </div>
</template>

<script setup>
import { computed } from 'vue'

import BaseInfoCard from '@/components/base/BaseInfoCard.vue'

const props = defineProps({
    loan: {
        type: Object,
        required: true,
    },
})

const emit = defineEmits([
    'open',
])

const statusLabel = computed(() => {
    const labels = {
        'on-time': 'Em dia',
        attention: 'Pequeno atraso',
        overdue: 'Atrasado',
    }

    return (
        labels[props.loan.status] ??
        props.loan.status
    )
})

const statusClasses = computed(() => {
    const classes = {
        'on-time':
            'bg-[#166534] text-white',
        attention:
            'bg-[#d97706] text-white',
        overdue:
            'bg-[#b91c1c] text-white',
    }

    return (
        classes[props.loan.status] ??
        'bg-[#52525b] text-white'
    )
})

const paidInstallmentsLabel =
    computed(() => {
        const paid =
            props.loan
                .paidInstallments ?? 0

        const total =
            props.loan
                .installmentCount ?? 0

        return `${paid} de ${total}`
    })

const lateDaysLabel = computed(() => {
    const days =
        props.loan.daysLate ?? 0

    if (days === 1) {
        return '1 dia de atraso'
    }

    return `${days} dias de atraso`
})

function openLoan() {
    emit('open')
}

function formatCurrency(value) {
    return new Intl.NumberFormat(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL',
        },
    ).format(Number(value) || 0)
}

function formatPercentage(value) {
    return `${Number(value) || 0}%`
}
</script>