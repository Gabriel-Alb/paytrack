<template>
    <BaseModal :model-value="modelValue" title="Parcelas do contrato" :description="modalDescription"
        panel-class="sm:max-w-[780px]" content-class="sm:py-5" @update:model-value="updateModelValue"
        @close="closeModal">
        <div v-if="loan">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <div class="min-w-0 rounded-xl border border-black/[0.06] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] sm:text-[10px]">
                        Valor emprestado
                    </p>

                    <p class="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ formatCurrency(loan.amount) }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.06] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] sm:text-[10px]">
                        Parcelas pagas
                    </p>

                    <p class="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ paidInstallmentsCount }}/{{ totalInstallments }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.06] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] sm:text-[10px]">
                        Multa diária
                    </p>

                    <p class="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ formatCurrency(dailyLateFee) }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.06] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa] sm:text-[10px]">
                        Valor já pago
                    </p>

                    <p class="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ formatCurrency(amountPaid) }}
                    </p>
                </div>
            </div>

            <div class="mt-5">
                <div>
                    <h3 class="text-[13px] font-semibold text-[#27272a]">
                        Parcelas do contrato
                    </h3>

                    <p class="mt-1 text-[11px] leading-5 text-[#8b8b93]">
                        Clique na parcela para visualizar os detalhes. Clique no
                        número para registrar ou remover o pagamento.
                    </p>
                </div>

                <div class="mt-3 flex flex-col gap-2">
                    <div v-for="installment in installments" :key="installment.number"
                        class="overflow-hidden rounded-xl border transition-[border-color,background-color,box-shadow] duration-200"
                        :class="getInstallmentContainerClass(installment)">
                        <div role="button" tabindex="0"
                            class="flex cursor-pointer items-center justify-between gap-3 p-3 outline-none transition-colors duration-150 sm:p-3.5"
                            :class="isPaid(installment.number)
                                    ? 'hover:bg-[#166534]/[0.02]'
                                    : 'hover:bg-[#fafafa]'
                                " @click="toggleExpanded(installment.number)" @keydown.enter.prevent="
                                toggleExpanded(installment.number)
                                " @keydown.space.prevent="
                                toggleExpanded(installment.number)
                                ">
                            <div class="flex min-w-0 flex-1 items-center gap-3">
                                <button type="button"
                                    class="group relative flex size-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-95"
                                    :class="isPaid(installment.number)
                                            ? 'bg-[#166534] text-white hover:bg-[#14532d]'
                                            : 'bg-[#f4f4f5] text-[#52525b] hover:bg-[#166534] hover:text-white'
                                        " :aria-label="isPaid(installment.number)
                                            ? `Remover pagamento da parcela ${installment.number}`
                                            : `Marcar parcela ${installment.number} como paga`
                                        " @click.stop="togglePayment(installment)">
                                    <span v-if="isPaid(installment.number)" class="mdi mdi-check text-lg"
                                        aria-hidden="true" />

                                    <template v-else>
                                        <span class="transition-opacity duration-150 group-hover:opacity-0">
                                            {{ installment.number }}
                                        </span>

                                        <span
                                            class="mdi mdi-check absolute text-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                                            aria-hidden="true" />
                                    </template>
                                </button>

                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p class="text-[12px] font-semibold" :class="isPaid(installment.number)
                                                ? 'text-[#166534]'
                                                : 'text-[#3f3f46]'
                                            ">
                                            Parcela {{ installment.number }}
                                        </p>

                                        <span v-if="
                                            installment.isOverdue &&
                                            !isPaid(installment.number)
                                        "
                                            class="rounded-md bg-[#b91c1c] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.04em] text-white">
                                            Atrasada
                                        </span>

                                        <span v-if="
                                            hasPendingLateFee(
                                                installment.number,
                                            )
                                        "
                                            class="rounded-md bg-[#d97706] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.04em] text-white">
                                            Multa pendente
                                        </span>
                                    </div>

                                    <div
                                        class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[#8b8b93]">
                                        <span>
                                            Vencimento
                                            {{ formatDate(installment.dueDate) }}
                                        </span>

                                        <template v-if="
                                            isPaid(installment.number) &&
                                            getPaymentDate(
                                                installment.number,
                                            )
                                        ">
                                            <span class="text-black/20">
                                                •
                                            </span>

                                            <span>
                                                Pago em
                                                {{
                                                    formatDate(
                                                        getPaymentDate(
                                                            installment.number,
                                                        ),
                                                    )
                                                }}
                                            </span>
                                        </template>
                                    </div>
                                </div>
                            </div>

                            <div class="flex shrink-0 items-center gap-2 sm:gap-3">
                                <template v-if="
                                    hasPendingLateFee(
                                        installment.number,
                                    )
                                ">
                                    <div class="flex flex-col items-end leading-none">
                                        <span
                                            class="text-[10px] font-medium text-[#71717a] line-through sm:text-[11px]">
                                            {{
                                                formatCurrency(
                                                    installment.value,
                                                )
                                            }}
                                        </span>

                                        <span class="mt-1 text-[10px] font-semibold text-[#b91c1c] sm:text-[11px]">
                                            +
                                            {{
                                                formatCurrency(
                                                    getOutstandingLateFee(
                                                        installment.number,
                                                    ),
                                                )
                                            }}
                                        </span>
                                    </div>
                                </template>

                                <span v-else class="text-[11px] font-semibold text-[#27272a] sm:text-[12px]">
                                    {{ formatCurrency(installment.value) }}
                                </span>

                                <span class="mdi shrink-0 text-lg text-[#a1a1aa] transition-transform duration-200"
                                    :class="isExpanded(installment.number)
                                            ? 'mdi-chevron-up'
                                            : 'mdi-chevron-down'
                                        " aria-hidden="true" />
                            </div>
                        </div>

                        <div v-if="isExpanded(installment.number)"
                            class="min-w-0 border-t border-black/[0.06] bg-white px-3 pb-3 pt-3 sm:px-3.5 sm:pb-3.5"
                            @click.stop>
                            <template v-if="!isPaid(installment.number)">
                                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <InfoItem label="Vencimento" :value="formatDate(installment.dueDate)
                                        " />

                                    <InfoItem label="Dias de atraso" :value="installment.currentLateDays > 0
                                            ? `${installment.currentLateDays} dias`
                                            : 'Em dia'
                                        " :value-class="installment.currentLateDays > 0
                                                ? 'text-[#b91c1c]'
                                                : 'text-[#3f3f46]'
                                            " />

                                    <InfoItem label="Multa diária" :value="formatCurrency(dailyLateFee)
                                        " />

                                    <InfoItem label="Multa acumulada" :value="formatCurrency(
                                        installment.currentLateFee,
                                    )
                                        " :value-class="installment.currentLateFee > 0
                                                ? 'text-[#b91c1c]'
                                                : 'text-[#3f3f46]'
                                            " />
                                </div>
                            </template>

                            <template v-else>
                                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <InfoItem label="Vencimento" :value="formatDate(installment.dueDate)
                                        " />

                                    <InfoItem label="Pago em" :value="formatDate(
                                        getPaymentDate(
                                            installment.number,
                                        ),
                                    )
                                        " />

                                    <InfoItem label="Valor da parcela" :value="formatCurrency(installment.value)
                                        " />

                                    <InfoItem label="Dias de atraso" :value="getPaymentLateDays(
                                        installment.number,
                                    ) > 0
                                            ? `${getPaymentLateDays(installment.number)} dias`
                                            : 'Sem atraso'
                                        " :value-class="getPaymentLateDays(
                                            installment.number,
                                        ) > 0
                                                ? 'text-[#b91c1c]'
                                                : 'text-[#3f3f46]'
                                            " />

                                    <InfoItem label="Multa diária" :value="formatCurrency(dailyLateFee)
                                        " />

                                    <InfoItem label="Multa acumulada" :value="formatCurrency(
                                        getPaymentLateFee(
                                            installment.number,
                                        ),
                                    )
                                        " />

                                    <InfoItem label="Total recebido" :value="formatCurrency(
                                        getPaymentTotal(installment),
                                    )
                                        " value-class="text-[#166534]" wrapper-class="col-span-2" />
                                </div>

                                <div class="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div class="min-w-0 overflow-hidden">
                                        <label :for="`payment-date-${installment.number}`"
                                            class="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#71717a]">
                                            Data do pagamento
                                        </label>

                                        <div class="min-w-0 overflow-hidden">
                                            <input :id="`payment-date-${installment.number}`" :value="getPaymentDate(
                                                installment.number,
                                            )
                                                " type="date" :max="today"
                                                class="block h-10 w-full min-w-0 max-w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] text-[#27272a] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.07)] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
                                                @input="
                                                    updatePaymentDate(
                                                        installment,
                                                        $event.target.value,
                                                    )
                                                    " />
                                        </div>
                                    </div>

                                    <div class="min-w-0">
                                        <p
                                            class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#71717a]">
                                            Pagamento registrado por
                                        </p>

                                        <div
                                            class="flex h-10 w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-black/[0.06] bg-[#fafafa] px-3">
                                            <span class="mdi mdi-account-outline shrink-0 text-[17px] text-[#71717a]"
                                                aria-hidden="true" />

                                            <p class="min-w-0 flex-1 truncate text-[12px] font-medium text-[#52525b]">
                                                {{
                                                    getRegisteredBy(
                                                        installment.number,
                                                    )
                                                }}
                                            </p>

                                            <span class="mdi mdi-lock-outline shrink-0 text-[14px] text-[#a1a1aa]"
                                                aria-hidden="true" />
                                        </div>
                                    </div>
                                </div>

                                <div v-if="
                                    getPaymentDate(installment.number) &&
                                    getPaymentLateDays(
                                        installment.number,
                                    ) > 0
                                " class="mt-3 rounded-xl border border-black/[0.06] bg-[#fafafa] p-3">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div class="min-w-0">
                                            <p class="text-[11px] font-semibold text-[#3f3f46]">
                                                Multa de
                                                {{
                                                    formatCurrency(
                                                        getPaymentLateFee(
                                                            installment.number,
                                                        ),
                                                    )
                                                }}
                                                recebida?
                                            </p>

                                            <p class="mt-0.5 text-[9px] leading-4 text-[#8b8b93]">
                                                Informe o valor recebido junto
                                                com a parcela.
                                            </p>
                                        </div>

                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <button type="button"
                                                class="inline-flex h-8 min-w-[48px] items-center justify-center rounded-lg border px-2.5 text-[10px] font-semibold transition-colors duration-150"
                                                :class="getLateFeeOption(
                                                    installment.number,
                                                ) === 'full'
                                                        ? 'border-[#166534] bg-[#166534] text-white'
                                                        : 'border-black/[0.08] bg-white text-[#52525b] hover:border-[#166534]/30 hover:text-[#166534]'
                                                    " @click="
                                                    setLateFeeOption(
                                                        installment.number,
                                                        'full',
                                                    )
                                                    ">
                                                Sim
                                            </button>

                                            <button type="button"
                                                class="inline-flex h-8 min-w-[48px] items-center justify-center rounded-lg border px-2.5 text-[10px] font-semibold transition-colors duration-150"
                                                :class="getLateFeeOption(
                                                    installment.number,
                                                ) === 'none'
                                                        ? 'border-[#b91c1c] bg-[#b91c1c] text-white'
                                                        : 'border-black/[0.08] bg-white text-[#52525b] hover:border-[#b91c1c]/30 hover:text-[#b91c1c]'
                                                    " @click="
                                                    setLateFeeOption(
                                                        installment.number,
                                                        'none',
                                                    )
                                                    ">
                                                Não
                                            </button>

                                            <button type="button"
                                                class="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-[10px] font-semibold transition-colors duration-150"
                                                :class="getLateFeeOption(
                                                    installment.number,
                                                ) === 'custom'
                                                        ? 'border-[#52525b] bg-[#52525b] text-white'
                                                        : 'border-black/[0.08] bg-white text-[#52525b] hover:border-[#52525b]/30'
                                                    " @click="
                                                    setLateFeeOption(
                                                        installment.number,
                                                        'custom',
                                                    )
                                                    ">
                                                Outro valor
                                            </button>
                                        </div>
                                    </div>

                                    <div v-if="
                                        getLateFeeOption(
                                            installment.number,
                                        ) === 'custom'
                                    " class="mt-3 min-w-0 sm:max-w-[220px]">
                                        <label :for="`custom-late-fee-${installment.number}`"
                                            class="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#71717a]">
                                            Valor da multa recebido
                                        </label>

                                        <div class="relative min-w-0">
                                            <span
                                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#8b8b93]">
                                                R$
                                            </span>

                                            <input :id="`custom-late-fee-${installment.number}`" :value="getCustomLateFeeValue(
                                                installment.number,
                                            )
                                                " type="number" inputmode="decimal" min="0" :max="getPaymentLateFee(
                                                    installment.number,
                                                )
                                                    " step="0.01" placeholder="0,00"
                                                class="block h-9 w-full min-w-0 max-w-full rounded-lg border border-black/[0.08] bg-white pl-9 pr-3 text-[11px] text-[#27272a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#a1a1aa] focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.07)]"
                                                @input="
                                                    updateCustomLateFee(
                                                        installment.number,
                                                        $event.target.value,
                                                    )
                                                    " />
                                        </div>
                                    </div>

                                    <div v-if="
                                        getLateFeeOption(
                                            installment.number,
                                        )
                                    " class="mt-3 grid grid-cols-2 gap-2 border-t border-black/[0.05] pt-3">
                                        <div>
                                            <p
                                                class="text-[9px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa]">
                                                Multa recebida
                                            </p>

                                            <p class="mt-1 text-[11px] font-semibold text-[#3f3f46]">
                                                {{
                                                    formatCurrency(
                                                        getLateFeeReceivedAmount(
                                                            installment.number,
                                                        ),
                                                    )
                                                }}
                                            </p>
                                        </div>

                                        <div>
                                            <p
                                                class="text-[9px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa]">
                                                Saldo da multa
                                            </p>

                                            <p class="mt-1 text-[11px] font-semibold" :class="hasPendingLateFee(
                                                installment.number,
                                            )
                                                    ? 'text-[#b91c1c]'
                                                    : 'text-[#3f3f46]'
                                                ">
                                                {{
                                                    formatCurrency(
                                                        getOutstandingLateFee(
                                                            installment.number,
                                                        ),
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-3 flex items-center justify-end border-t border-black/[0.05] pt-3">
                                    <button type="button"
                                        class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fef2f2]"
                                        @click="
                                            removePayment(
                                                installment.number,
                                            )
                                            ">
                                        <span class="mdi mdi-close text-[15px]" aria-hidden="true" />

                                        Remover pagamento
                                    </button>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <button type="button"
                class="inline-flex h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#52525b] transition-colors hover:bg-[#fafafa] active:bg-[#f4f4f5]"
                @click="cancel">
                Cancelar
            </button>

            <button type="button" :disabled="hasIncompletePayments"
                class="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-[12px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-[#14532d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                @click="confirm">
                <span class="mdi mdi-check text-lg" aria-hidden="true" />

                Confirmar
            </button>
        </template>
    </BaseModal>
</template>

<script setup>
import {
    computed,
    defineComponent,
    h,
    ref,
    watch,
} from 'vue'

import BaseModal from '@/components/base/BaseModal.vue'

const InfoItem = defineComponent({
    props: {
        label: {
            type: String,
            required: true,
        },

        value: {
            type: String,
            required: true,
        },

        valueClass: {
            type: String,
            default: 'text-[#3f3f46]',
        },

        wrapperClass: {
            type: String,
            default: '',
        },
    },

    setup(props) {
        return () =>
            h(
                'div',
                {
                    class: [
                        'min-w-0 rounded-lg border border-black/[0.05] bg-[#fafafa] p-2.5 sm:p-3',
                        props.wrapperClass,
                    ],
                },
                [
                    h(
                        'p',
                        {
                            class: 'text-[8px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa] sm:text-[9px]',
                        },
                        props.label,
                    ),

                    h(
                        'p',
                        {
                            class: [
                                'mt-1 truncate text-[10px] font-semibold sm:text-[11px]',
                                props.valueClass,
                            ],
                        },
                        props.value,
                    ),
                ],
            )
    },
})

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },

    loan: {
        type: Object,
        default: null,
    },

    registeredBy: {
        type: String,
        default: 'Administrador',
    },
})

const emit = defineEmits([
    'update:modelValue',
    'close',
    'confirm-payments',
])

const paymentSelections = ref({})
const expandedInstallment = ref(null)

const today = getToday()

const modalDescription = computed(() => {
    if (!props.loan) {
        return ''
    }

    return `${props.loan.clientName} · Empréstimo #${props.loan.id}`
})

const totalInstallments = computed(() => {
    return Math.max(
        Number(props.loan?.installmentCount) || 0,
        0,
    )
})

const dailyLateFee = computed(() => {
    return Number(props.loan?.dailyLateFee) || 0
})

const installments = computed(() => {
    if (!props.loan) {
        return []
    }

    return Array.from(
        {
            length: totalInstallments.value,
        },
        (_, index) => {
            const number = index + 1

            const customValue =
                props.loan.installments?.[index]

            const value =
                Number(customValue) ||
                Number(props.loan.installmentValue) ||
                0

            const dueDate = buildDailyDueDate(
                props.loan.firstPaymentDate,
                index,
            )

            const currentLateDays = calculateLateDays(
                dueDate,
                today,
            )

            return {
                number,
                value,
                dueDate,

                currentLateDays,

                currentLateFee:
                    currentLateDays *
                    dailyLateFee.value,

                isOverdue:
                    currentLateDays > 0,
            }
        },
    )
})

const paidInstallmentsCount = computed(() => {
    return Object.keys(
        paymentSelections.value,
    ).length
})

const amountPaid = computed(() => {
    return installments.value.reduce(
        (total, installment) => {
            const payment =
                getPayment(
                    installment.number,
                )

            if (
                !payment ||
                !payment.paidAt
            ) {
                return total
            }

            return (
                total +
                installment.value +
                getLateFeeReceivedAmount(
                    installment.number,
                )
            )
        },
        0,
    )
})

const outstandingLateFeeDebt = computed(() => {
    return Object.keys(
        paymentSelections.value,
    ).reduce(
        (total, number) =>
            total +
            getOutstandingLateFee(
                Number(number),
            ),
        0,
    )
})

const remainingInstallmentsValue = computed(() => {
    return installments.value.reduce(
        (total, installment) => {
            if (
                isPaid(
                    installment.number,
                )
            ) {
                return total
            }

            return (
                total +
                installment.value
            )
        },
        0,
    )
})

const outstandingBalance = computed(() => {
    return (
        remainingInstallmentsValue.value +
        outstandingLateFeeDebt.value
    )
})

const hasIncompletePayments = computed(() => {
    return Object.values(
        paymentSelections.value,
    ).some((payment) => {
        if (!payment.paidAt) {
            return true
        }

        if (
            Number(payment.lateDays) <=
            0
        ) {
            return false
        }

        if (!payment.lateFeeOption) {
            return true
        }

        if (
            payment.lateFeeOption ===
            'custom' &&
            (
                payment.customLateFeeValue ===
                '' ||
                payment.customLateFeeValue ===
                null
            )
        ) {
            return true
        }

        return false
    })
})

function getInstallmentContainerClass(
    installment,
) {
    if (
        hasPendingLateFee(
            installment.number,
        )
    ) {
        return 'border-[#d97706]/20 bg-[#fffdfa]'
    }

    if (
        isPaid(
            installment.number,
        )
    ) {
        return 'border-[#166534]/20 bg-[#f0fdf4]'
    }

    if (installment.isOverdue) {
        return 'border-[#b91c1c]/15 bg-white'
    }

    return 'border-black/[0.07] bg-white'
}

function isPaid(number) {
    return Object.prototype.hasOwnProperty.call(
        paymentSelections.value,
        number,
    )
}

function isExpanded(number) {
    return (
        expandedInstallment.value ===
        number
    )
}

function toggleExpanded(number) {
    expandedInstallment.value =
        isExpanded(number)
            ? null
            : number
}

function getPayment(number) {
    return (
        paymentSelections.value[number] ??
        null
    )
}

function getPaymentDate(number) {
    return (
        getPayment(number)?.paidAt ??
        ''
    )
}

function getRegisteredBy(number) {
    return (
        getPayment(number)?.registeredBy ||
        props.registeredBy
    )
}

function getPaymentLateDays(number) {
    return (
        Number(
            getPayment(number)?.lateDays,
        ) || 0
    )
}

function getPaymentLateFee(number) {
    return (
        Number(
            getPayment(number)
                ?.lateFeeAmount,
        ) || 0
    )
}

function getLateFeeOption(number) {
    return (
        getPayment(number)
            ?.lateFeeOption ?? null
    )
}

function getCustomLateFeeValue(number) {
    return (
        getPayment(number)
            ?.customLateFeeValue ?? ''
    )
}

function getLateFeeReceivedAmount(number) {
    const payment =
        getPayment(number)

    if (!payment) {
        return 0
    }

    if (
        Number(payment.lateDays) <=
        0
    ) {
        return 0
    }

    const lateFeeAmount =
        Number(
            payment.lateFeeAmount,
        ) || 0

    if (
        payment.lateFeeOption ===
        'full'
    ) {
        return lateFeeAmount
    }

    if (
        payment.lateFeeOption ===
        'custom'
    ) {
        return Math.min(
            Math.max(
                Number(
                    payment.customLateFeeValue,
                ) || 0,
                0,
            ),
            lateFeeAmount,
        )
    }

    return 0
}

function getOutstandingLateFee(number) {
    const expected =
        getPaymentLateFee(number)

    const received =
        getLateFeeReceivedAmount(
            number,
        )

    return Math.max(
        expected - received,
        0,
    )
}

function hasPendingLateFee(number) {
    return (
        isPaid(number) &&
        getOutstandingLateFee(number) >
        0
    )
}

function getPaymentTotal(installment) {
    return (
        installment.value +
        getLateFeeReceivedAmount(
            installment.number,
        )
    )
}

function togglePayment(installment) {
    const number =
        installment.number

    if (isPaid(number)) {
        removePayment(number)
        return
    }

    paymentSelections.value = {
        ...paymentSelections.value,

        [number]: {
            installmentNumber:
                number,

            paidAt: '',

            registeredBy:
                props.registeredBy,

            lateDays: 0,

            lateFeeAmount: 0,

            lateFeeOption: null,

            customLateFeeValue: '',
        },
    }

    expandedInstallment.value =
        number
}

function updatePaymentDate(
    installment,
    paidAt,
) {
    const payment =
        getPayment(
            installment.number,
        )

    if (!payment) {
        return
    }

    const lateDays =
        paidAt
            ? calculateLateDays(
                installment.dueDate,
                paidAt,
            )
            : 0

    const lateFeeAmount =
        lateDays *
        dailyLateFee.value

    paymentSelections.value = {
        ...paymentSelections.value,

        [installment.number]: {
            ...payment,

            paidAt,

            lateDays,

            lateFeeAmount,

            lateFeeOption:
                lateDays > 0
                    ? null
                    : 'full',

            customLateFeeValue:
                '',
        },
    }
}

function setLateFeeOption(
    number,
    option,
) {
    const payment =
        getPayment(number)

    if (!payment) {
        return
    }

    paymentSelections.value = {
        ...paymentSelections.value,

        [number]: {
            ...payment,

            lateFeeOption:
                option,

            customLateFeeValue:
                option === 'custom'
                    ? payment.customLateFeeValue ??
                    ''
                    : '',
        },
    }
}

function updateCustomLateFee(
    number,
    value,
) {
    const payment =
        getPayment(number)

    if (!payment) {
        return
    }

    const maximumValue =
        Number(
            payment.lateFeeAmount,
        ) || 0

    const normalizedValue =
        value === ''
            ? ''
            : Math.min(
                Math.max(
                    Number(value) || 0,
                    0,
                ),
                maximumValue,
            )

    paymentSelections.value = {
        ...paymentSelections.value,

        [number]: {
            ...payment,

            customLateFeeValue:
                normalizedValue,
        },
    }
}

function removePayment(number) {
    const nextPayments = {
        ...paymentSelections.value,
    }

    delete nextPayments[number]

    paymentSelections.value =
        nextPayments

    if (
        expandedInstallment.value ===
        number
    ) {
        expandedInstallment.value =
            null
    }
}

function initializeSelections() {
    expandedInstallment.value =
        null

    if (!props.loan) {
        paymentSelections.value =
            {}

        return
    }

    const nextPayments = {}

    if (
        Array.isArray(
            props.loan.payments,
        ) &&
        props.loan.payments.length
    ) {
        props.loan.payments.forEach(
            (payment) => {
                const number =
                    Number(
                        payment.installmentNumber,
                    )

                if (!number) {
                    return
                }

                const installment =
                    installments.value.find(
                        (item) =>
                            item.number ===
                            number,
                    )

                const lateDays =
                    payment.paidAt &&
                        installment?.dueDate
                        ? calculateLateDays(
                            installment.dueDate,
                            payment.paidAt,
                        )
                        : 0

                const lateFeeAmount =
                    lateDays *
                    dailyLateFee.value

                const receivedAmount =
                    Number(
                        payment.lateFeeReceivedAmount,
                    )

                let lateFeeOption = null
                let customLateFeeValue = ''

                if (lateDays <= 0) {
                    lateFeeOption = 'full'
                } else if (
                    Number.isFinite(
                        receivedAmount,
                    )
                ) {
                    if (
                        receivedAmount <= 0
                    ) {
                        lateFeeOption =
                            'none'
                    } else if (
                        receivedAmount >=
                        lateFeeAmount
                    ) {
                        lateFeeOption =
                            'full'
                    } else {
                        lateFeeOption =
                            'custom'

                        customLateFeeValue =
                            receivedAmount
                    }
                } else if (
                    payment.lateFeePaid ===
                    true
                ) {
                    lateFeeOption = 'full'
                } else if (
                    payment.lateFeePaid ===
                    false
                ) {
                    lateFeeOption = 'none'
                }

                nextPayments[number] = {
                    installmentNumber:
                        number,

                    paidAt:
                        payment.paidAt ??
                        '',

                    registeredBy:
                        payment.registeredBy ||
                        props.registeredBy,

                    lateDays,

                    lateFeeAmount,

                    lateFeeOption,

                    customLateFeeValue,
                }
            },
        )

        paymentSelections.value =
            nextPayments

        return
    }

    const paidCount = Math.min(
        Number(
            props.loan.paidInstallments,
        ) || 0,
        totalInstallments.value,
    )

    for (
        let index = 0;
        index < paidCount;
        index += 1
    ) {
        const number = index + 1

        const installment =
            installments.value.find(
                (item) =>
                    item.number ===
                    number,
            )

        nextPayments[number] = {
            installmentNumber:
                number,

            paidAt:
                installment?.dueDate ??
                '',

            registeredBy:
                props.registeredBy,

            lateDays: 0,

            lateFeeAmount: 0,

            lateFeeOption: 'full',

            customLateFeeValue: '',
        }
    }

    paymentSelections.value =
        nextPayments
}

function confirm() {
    if (
        !props.loan ||
        hasIncompletePayments.value
    ) {
        return
    }

    const payments =
        Object.values(
            paymentSelections.value,
        )
            .map((payment) => {
                const number =
                    Number(
                        payment.installmentNumber,
                    )

                const receivedAmount =
                    getLateFeeReceivedAmount(
                        number,
                    )

                const lateFeeAmount =
                    Number(
                        payment.lateFeeAmount,
                    ) || 0

                return {
                    installmentNumber:
                        number,

                    paidAt:
                        payment.paidAt,

                    registeredBy:
                        payment.registeredBy ||
                        props.registeredBy,

                    lateDays:
                        Number(
                            payment.lateDays,
                        ) || 0,

                    lateFeeAmount,

                    lateFeeReceivedAmount:
                        receivedAmount,

                    lateFeePaid:
                        lateFeeAmount <= 0 ||
                        receivedAmount >=
                        lateFeeAmount,

                    lateFeeOption:
                        payment.lateFeeOption,
                }
            })
            .sort(
                (first, second) =>
                    first.installmentNumber -
                    second.installmentNumber,
            )

    emit('confirm-payments', {
        loanId:
            props.loan.id,

        payments,

        amountPaid:
            amountPaid.value,

        outstandingLateFeeDebt:
            outstandingLateFeeDebt.value,

        outstandingBalance:
            outstandingBalance.value,
    })

    expandedInstallment.value =
        null

    emit(
        'update:modelValue',
        false,
    )
}

function cancel() {
    emit(
        'update:modelValue',
        false,
    )

    emit('close')
}

function updateModelValue(value) {
    emit(
        'update:modelValue',
        value,
    )
}

function closeModal() {
    expandedInstallment.value =
        null

    emit('close')
}

function calculateLateDays(
    dueDate,
    comparisonDate,
) {
    const due =
        parseISODate(dueDate)

    const comparison =
        parseISODate(
            comparisonDate,
        )

    if (!due || !comparison) {
        return 0
    }

    const difference =
        Math.floor(
            (
                comparison.getTime() -
                due.getTime()
            ) /
            86400000,
        )

    return Math.max(
        difference,
        0,
    )
}

function buildDailyDueDate(
    firstPaymentDate,
    dayOffset,
) {
    const date =
        parseISODate(
            firstPaymentDate,
        )

    if (!date) {
        return ''
    }

    date.setDate(
        date.getDate() +
        dayOffset,
    )

    return formatISODate(date)
}

function parseISODate(value) {
    if (!value) {
        return null
    }

    const [
        year,
        month,
        day,
    ] = value
        .split('-')
        .map(Number)

    if (
        !year ||
        !month ||
        !day
    ) {
        return null
    }

    return new Date(
        year,
        month - 1,
        day,
    )
}

function formatISODate(date) {
    return [
        date.getFullYear(),

        String(
            date.getMonth() + 1,
        ).padStart(
            2,
            '0',
        ),

        String(
            date.getDate(),
        ).padStart(
            2,
            '0',
        ),
    ].join('-')
}

function getToday() {
    return formatISODate(
        new Date(),
    )
}

function formatDate(value) {
    const date =
        parseISODate(value)

    if (!date) {
        return 'Não informado'
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
    ).format(date)
}

function formatCurrency(value) {
    return new Intl.NumberFormat(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL',
        },
    ).format(
        Number(value) || 0,
    )
}

watch(
    [
        () => props.modelValue,
        () => props.loan?.id,
    ],
    ([open]) => {
        if (open) {
            initializeSelections()
        }
    },
)
</script>