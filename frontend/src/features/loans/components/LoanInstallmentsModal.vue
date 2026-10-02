<template>
    <BaseModal :model-value="modelValue" title="Parcelas do contrato" :description="modalDescription"
        panel-class="sm:max-w-[780px]" content-class="sm:py-5" @update:model-value="updateModelValue"
        @close="closeModal">
        <div v-if="loan">
            <div class="mb-4 flex items-center justify-between gap-3">
                <p class="text-xs leading-5 text-[#71717a] [overflow-wrap:anywhere]">
                    Empresa: <span class="font-medium text-[#3f3f46]">{{ loan.companyName }}</span>
                </p>
                <button type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-[background-color,color,transform] duration-200 hover:bg-[#f4f4f5] hover:text-[#27272a] active:scale-95"
                    :aria-label="`Editar empréstimo de ${loan.clientName}`" title="Editar" @click.stop="emit('edit', loan)" @keydown.stop>
                    <span class="mdi mdi-pencil text-[18px]" aria-hidden="true" />
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <div class="min-w-0 rounded-xl border border-black/[0.07] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#71717a] sm:text-[10px]">
                        Valor emprestado
                    </p>

                    <p class="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ formatCurrency(loan.amount) }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.07] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#71717a] sm:text-[10px]">
                        Parcelas pagas
                    </p>

                    <p class="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ paidInstallmentsCount }}/{{ totalInstallments }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.07] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#71717a] sm:text-[10px]">
                        Multa diária
                    </p>

                    <p class="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        {{ formatCurrency(dailyLateFee) }}
                    </p>
                </div>

                <div class="min-w-0 rounded-xl border border-black/[0.07] bg-[#fafafa] p-3 sm:p-4">
                    <p class="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#71717a] sm:text-[10px]">
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

                    <p class="mt-1 text-[11px] leading-5 text-[#71717a]">
                        Clique na parcela para visualizar os detalhes. Clique no
                        número para registrar um pagamento.
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
                                        " :aria-label="`Registrar pagamento da parcela ${installment.number}`
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
                                        class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[#71717a]">
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

                                <span class="mdi shrink-0 text-lg text-[#71717a] transition-transform duration-200"
                                    :class="isExpanded(installment.number)
                                            ? 'mdi-chevron-up'
                                            : 'mdi-chevron-down'
                                        " aria-hidden="true" />
                            </div>
                        </div>

                        <div v-if="isExpanded(installment.number)"
                            class="min-w-0 border-t border-black/[0.07] bg-white px-3 pb-3 pt-3 sm:px-3.5 sm:pb-3.5"
                            @click.stop>
                            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <InfoItem label="Valor original da parcela" :value="formatCurrency(installment.value)" />
                                <InfoItem label="Saldo restante da parcela" :value="money(balance(installment).remaining)" />
                                <InfoItem label="Multa acumulada" :value="money(balance(installment).fee)" />
                                <InfoItem label="Multa pendente" :value="money(balance(installment).feeRemaining)" />
                                <InfoItem label="Total atualmente devido" :value="money(balance(installment).remaining + balance(installment).feeRemaining)" wrapper-class="col-span-2" />
                            </div>

                            <div v-if="getPayment(installment.number)" class="mt-3">
                                <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <label :for="`payment-date-${installment.number}`" class="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#71717a]">Data do pagamento</label>
                                        <input :id="`payment-date-${installment.number}`" v-model="paymentSelections[installment.number].paidAt"
                                            type="date" :min="loan.loanDate" :max="today"
                                            class="block h-10 w-full min-w-0 rounded-xl border border-black/[0.10] bg-white px-3 text-[12px] text-[#27272a] outline-none focus:border-[#166534]/40" />
                                    </div>
                                    <div>
                                        <label :for="`payment-amount-${installment.number}`" class="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#71717a]">Valor recebido</label>
                                        <input :id="`payment-amount-${installment.number}`" v-model="paymentSelections[installment.number].receivedAmount"
                                            type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0,00"
                                            class="block h-10 w-full min-w-0 rounded-xl border border-black/[0.10] bg-white px-3 text-[12px] text-[#27272a] outline-none focus:border-[#166534]/40" />
                                    </div>
                                </div>
                                <label class="mt-3 flex items-center gap-2 text-[12px] text-[#3f3f46]">
                                    <input v-model="paymentSelections[installment.number].feeOnly" type="checkbox" class="accent-[#166534]" />
                                    Pagamento somente da multa
                                </label>
                                <p class="mt-2 text-[10px] text-[#71717a]">Pagamento registrado por {{ registeredBy }}</p>
                                <div class="mt-3 grid grid-cols-2 gap-2" aria-live="polite">
                                    <InfoItem label="Destinado à multa" :value="money(allocation(installment).feeAmount)" />
                                    <InfoItem label="Destinado à parcela" :value="money(allocation(installment).amount)" />
                                    <InfoItem label="Saldo da parcela após pagamento" :value="money(allocation(installment).remaining)" />
                                    <InfoItem label="Multa pendente após pagamento" :value="money(allocation(installment).feeRemaining)" />
                                </div>
                                <p v-if="paymentError(installment)" role="alert" class="mt-2 text-[11px] text-[#b91c1c]">{{ paymentError(installment) }}</p>
                                <p v-else class="mt-2 text-[11px] text-[#71717a]">{{ allocation(installment).remaining > 0 ? 'A parcela continuará em aberto.' : 'A parcela será quitada.' }}</p>
                                <button type="button" class="mt-3 h-8 rounded-lg px-2.5 text-[10px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]" @click="removePayment(installment.number)">Cancelar lançamento</button>
                            </div>
                            <button v-else-if="balance(installment).remaining + balance(installment).feeRemaining > 0" type="button"
                                class="mt-3 h-8 rounded-lg bg-[#166534] px-3 text-[11px] font-semibold text-white hover:bg-[#14532d]"
                                @click="togglePayment(installment)">Registrar pagamento</button>

                            <div v-if="installmentPayments(installment).length" class="mt-3 border-t border-black/[0.07] pt-3">
                                <p class="text-[11px] font-semibold text-[#3f3f46]">Recebimentos registrados</p>
                                <div v-for="payment in installmentPayments(installment)" :key="payment.id" class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#71717a]">
                                    <div :class="{ 'line-through': voidPaymentIds.includes(payment.id) }">
                                        <p>{{ formatDate(payment.payment_date) }} · {{ money(payment.amount + payment.late_fee_amount) }} · {{ payment.registered_by || 'Não identificado' }}</p>
                                        <p>Parcela: {{ money(payment.amount) }} · Multa: {{ money(payment.late_fee_amount) }}</p>
                                    </div>
                                    <button type="button" class="h-8 rounded-lg px-2.5 font-semibold text-[#b91c1c] hover:bg-[#fef2f2]" @click="toggleVoid(payment.id)">
                                        {{ voidPaymentIds.includes(payment.id) ? 'Desfazer estorno' : 'Estornar pagamento' }}
                                    </button>
                                </div>
                            </div>
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
import { toCents, fromCents, currentDate } from '@/services/paytrack'
import {
    computed,
    defineComponent,
    h,
    ref,
    watch,
} from 'vue'

import BaseModal from '@/components/base/BaseModal.vue'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()
const registeredBy = computed(() => user.value?.name || 'Não identificado')

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
                        'min-w-0 rounded-lg border border-black/[0.07] bg-[#fafafa] p-2.5 sm:p-3',
                        props.wrapperClass,
                    ],
                },
                [
                    h(
                        'p',
                        {
                            class: 'text-[8px] font-semibold uppercase tracking-[0.05em] text-[#71717a] sm:text-[9px]',
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

})

const emit = defineEmits([
    'update:modelValue',
    'close',
    'confirm-payments',
    'edit',
])

const paymentSelections = ref({})
const voidPaymentIds = ref([])
const expandedInstallment = ref(null)
const today = ref(currentDate())
const modalDescription = computed(() => props.loan ? `${props.loan.clientName} · Empréstimo #${props.loan.id}` : '')
const totalInstallments = computed(() => props.loan?.installmentCount || 0)
const dailyLateFee = computed(() => Number(props.loan?.dailyLateFee) || 0)
const installments = computed(() => (props.loan?.installmentRows ?? []).map(item => ({ ...item, value: Number(item.value) })))
const paidInstallmentsCount = computed(() => installments.value.filter(item => isPaid(item.number)).length)
const amountPaid = computed(() => Number(fromCents(installments.value.reduce((total, item) => {
    const current = balance(item)
    return total + current.paid + current.feePaid
}, 0))))
const hasIncompletePayments = computed(() =>
    (!Object.keys(paymentSelections.value).length && !voidPaymentIds.value.length) ||
    installments.value.some(item => getPayment(item.number) && paymentError(item)),
)

function money(cents) { return formatCurrency(fromCents(cents)) }
function installmentPayments(installment) {
    return (props.loan?.paymentHistory ?? []).filter(payment => payment.installment_id === installment.id && !payment.voided_at)
}
function balance(installment) {
    const active = installmentPayments(installment).filter(payment => !voidPaymentIds.value.includes(payment.id))
    const paid = active.reduce((sum, payment) => sum + payment.amount, 0)
    const feePaid = active.reduce((sum, payment) => sum + payment.late_fee_amount, 0)
    const date = getPayment(installment.number)?.paidAt || today.value
    const paidAt = paid >= installment.amount ? active.filter(payment => payment.amount > 0).map(payment => payment.payment_date).sort().at(-1) : null
    const feeDate = paidAt && paidAt < date ? paidAt : date
    const fee = installment.late_fee_status === 'waived' ? 0 : calculateLateDays(installment.dueDate, feeDate) * props.loan.late_fee_per_day
    return { paid, feePaid, fee, remaining: Math.max(0, installment.amount - paid), feeRemaining: Math.max(0, fee - feePaid) }
}
function receivedCents(payment) {
    try {
        const value = toCents(payment?.receivedAmount)
        return value > 0 && value <= 100000000000 ? value : 0
    } catch { return 0 }
}
function allocation(installment) {
    const current = balance(installment)
    const payment = getPayment(installment.number)
    const received = receivedCents(payment)
    const feeAmount = Math.min(received, current.feeRemaining)
    const amount = payment?.feeOnly ? 0 : Math.min(current.remaining, received - feeAmount)
    return { feeAmount, amount, remaining: current.remaining - amount, feeRemaining: current.feeRemaining - feeAmount }
}
function paymentError(installment) {
    const payment = getPayment(installment.number)
    if (!payment) return ''
    if (!payment.paidAt || payment.paidAt < props.loan.loanDate || payment.paidAt > today.value)
        return 'Informe uma data entre a data do empréstimo e hoje.'
    const lastDate = installmentPayments(installment).filter(item => !voidPaymentIds.value.includes(item.id)).map(item => item.payment_date).sort().at(-1)
    if (lastDate && payment.paidAt < lastDate) return 'O pagamento não pode anteceder os recebimentos já registrados.'
    const received = receivedCents(payment)
    if (!received) return 'Informe um valor maior que zero, com até duas casas decimais, dentro do limite permitido.'
    const current = balance(installment)
    if (received > (payment.feeOnly ? current.feeRemaining : current.remaining + current.feeRemaining))
        return payment.feeOnly ? 'O valor excede a multa pendente.' : 'O valor excede o total devido.'
    return ''
}
function getInstallmentContainerClass(installment) {
    if (hasPendingLateFee(installment.number)) return 'border-[#d97706]/20 bg-[#fffdfa]'
    if (isPaid(installment.number)) return 'border-[#166534]/20 bg-[#f0fdf4]'
    return installment.isOverdue ? 'border-[#b91c1c]/15 bg-white' : 'border-black/[0.08] bg-white'
}
function isPaid(number) {
    const installment = installments.value.find(item => item.number === number)
    return installment && balance(installment).remaining === 0
}
function isExpanded(number) { return expandedInstallment.value === number }
function toggleExpanded(number) { expandedInstallment.value = isExpanded(number) ? null : number }
function getPayment(number) { return paymentSelections.value[number] ?? null }
function getPaymentDate(number) {
    return installments.value.find(item => item.number === number)?.paid_at || ''
}
function getOutstandingLateFee(number) {
    const installment = installments.value.find(item => item.number === number)
    return installment ? Number(fromCents(balance(installment).feeRemaining)) : 0
}
function hasPendingLateFee(number) { return isPaid(number) && getOutstandingLateFee(number) > 0 }
function togglePayment(installment) {
    expandedInstallment.value = installment.number
    if (getPayment(installment.number)) return
    const current = balance(installment)
    if (current.remaining + current.feeRemaining <= 0) return
    paymentSelections.value[installment.number] = {
        installmentNumber: installment.number, paidAt: today.value, receivedAmount: '', feeOnly: false,
    }
}
function removePayment(number) { delete paymentSelections.value[number] }
function toggleVoid(id) {
    voidPaymentIds.value = voidPaymentIds.value.includes(id)
        ? voidPaymentIds.value.filter(value => value !== id) : [...voidPaymentIds.value, id]
}
function initializeSelections() {
    today.value = currentDate()
    expandedInstallment.value = null
    paymentSelections.value = {}
    voidPaymentIds.value = []
}
function confirm() {
    if (!props.loan || hasIncompletePayments.value) return
    emit('confirm-payments', {
        loanId: props.loan.id,
        payments: Object.values(paymentSelections.value),
        voidPaymentIds: voidPaymentIds.value,
    })
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
        () => props.loan?.revision,
    ],
    ([open]) => {
        if (open) {
            initializeSelections()
        }
    },
)
</script>
