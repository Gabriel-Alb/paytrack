<template>
    <BaseModal :model-value="modelValue" title="Histórico" :description="client?.name || ''" icon="mdi mdi-history"
        panel-class="sm:max-w-[620px]" content-class="bg-[#f7f7f7]" @update:model-value="
            emit('update:modelValue', $event)
            " @close="emit('close')">
        <template v-if="client?.loans?.length">
            <div class="space-y-3">
                <article v-for="loan in client.loans" :key="loan.id"
                    class="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
                    <div class="p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-[11px] font-medium text-black/35">
                                    Empréstimo #{{
                                        String(
                                            loan.id,
                                        ).padStart(
                                            4,
                                            '0',
                                        )
                                    }}
                                </p>

                                <p class="mt-1 text-lg font-semibold text-[#202124]">
                                    {{
                                        formatCurrency(
                                            loan.amount,
                                        )
                                    }}
                                </p>
                            </div>

                            <span :class="[
                                'inline-flex shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold',
                                getStatusClasses(
                                    loan.status,
                                ),
                            ]">
                                {{
                                    getStatusLabel(
                                        loan.status,
                                    )
                                }}
                            </span>
                        </div>

                        <div class="mt-4 grid grid-cols-2 gap-3 border-t border-black/[0.05] pt-4 sm:grid-cols-3">
                            <div>
                                <p :class="labelClass">
                                    Parcelas
                                </p>

                                <p :class="valueClass">
                                    {{
                                        loan.installments
                                    }}
                                </p>
                            </div>

                            <div>
                                <p :class="labelClass">
                                    Início
                                </p>

                                <p :class="valueClass">
                                    {{
                                        formatDate(
                                            loan.startDate,
                                        )
                                    }}
                                </p>
                            </div>

                            <div class="col-span-2 sm:col-span-1">
                                <p :class="labelClass">
                                    Término
                                </p>

                                <p :class="valueClass">
                                    {{
                                        loan.endDate
                                            ? formatDate(
                                                loan.endDate,
                                            )
                                            : 'Em aberto'
                                    }}
                                </p>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </template>

        <div v-else class="flex min-h-[260px] flex-col items-center justify-center text-center">
            <div class="flex size-12 items-center justify-center rounded-xl bg-[#166534]/[0.08] text-[#166534]">
                <span class="mdi mdi-history text-[24px]" />
            </div>

            <p class="mt-3 text-sm font-semibold text-[#202124]">
                Nenhum empréstimo
            </p>

            <p class="mt-1 max-w-[250px] text-xs leading-5 text-black/40">
                Este cliente ainda não possui histórico de
                empréstimos.
            </p>
        </div>
    </BaseModal>
</template>

<script setup>
import BaseModal from '@/components/base/BaseModal.vue'

defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },

    client: {
        type: Object,
        default: null,
    },
})

const emit = defineEmits([
    'update:modelValue',
    'close',
])

const labelClass =
    'text-[10px] font-semibold uppercase tracking-[0.04em] text-black/30'

const valueClass =
    'mt-1 text-xs font-semibold text-black/60'

const currencyFormatter =
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })

const dateFormatter =
    new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'UTC',
    })

function formatCurrency(value) {
    return currencyFormatter.format(value)
}

function formatDate(value) {
    return dateFormatter.format(
        new Date(
            `${value}T00:00:00Z`,
        ),
    )
}

function getStatusLabel(status) {
    const labels = {
        ativo: 'Ativo',
        quitado: 'Quitado',
        negativado: 'Negativado',
    }

    return labels[status] ?? status
}

function getStatusClasses(status) {
    const classes = {
        ativo: 'border-[#166534]/15 bg-[#166534]/[0.07] text-[#166534]',
        quitado:
            'border-black/[0.08] bg-black/[0.04] text-black/50',
        negativado:
            'border-red-700/10 bg-red-50 text-red-700',
    }

    return (
        classes[status] ??
        'border-black/[0.08] bg-black/[0.04] text-black/50'
    )
}
</script>