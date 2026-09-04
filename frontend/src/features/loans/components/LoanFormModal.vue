<template>
    <BaseModal :model-value="open" title="Novo empréstimo" description="Preencha as condições combinadas com o cliente."
        panel-class="sm:max-w-[860px]" content-class="overflow-x-hidden touch-pan-y" :close-on-backdrop="false"
        @update:model-value="handleModalModelValue">
        <form id="loan-form" class="w-full min-w-0 max-w-full space-y-7 overflow-x-hidden" @submit.prevent="submit"
            @keydown.enter.prevent>
            <section class="min-w-0">

                <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <LoanClientSelect v-model="form.clientId" :clients="clients"
                        @request-new-client="requestNewClient" />

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            CPF
                        </span>

                        <div class="relative min-w-0">
                            <input :value="selectedClient?.cpf ?? ''" readonly type="text"
                                placeholder="Selecione um cliente"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.07] bg-[#f4f4f5] px-3 pr-9 text-sm text-[#71717a] outline-none placeholder:text-black/25" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#a1a1aa]"
                                aria-hidden="true" />
                        </div>
                    </label>
                </div>
            </section>

            <section class="min-w-0">

                <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Valor emprestado
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                R$
                            </span>

                            <input v-model.number="form.amount" required min="0" step="0.01" type="number"
                                placeholder="0,00"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Juros
                        </span>

                        <div class="relative min-w-0">
                            <input v-model.number="form.interest" required min="0" step="0.01" type="number"
                                placeholder="0"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white px-3 pr-10 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />

                            <span
                                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                %
                            </span>
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Valor com juros
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8b8b93]">
                                R$
                            </span>

                            <input :value="formatInputValue(totalWithInterest)" readonly type="text"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.07] bg-[#f4f4f5] pl-10 pr-9 text-sm font-semibold text-[#52525b] outline-none" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#a1a1aa]"
                                aria-hidden="true" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Lucro
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8b8b93]">
                                R$
                            </span>

                            <input :value="formatInputValue(profit)" readonly type="text"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.07] bg-[#f4f4f5] pl-10 pr-9 text-sm font-semibold text-[#166534] outline-none" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#a1a1aa]"
                                aria-hidden="true" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Quantidade de parcelas
                        </span>

                        <input v-model.number="form.installmentCount" required min="1" max="120" type="number"
                            placeholder="1"
                            class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Multa por dia de atraso
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                R$
                            </span>

                            <input v-model.number="form.dailyLateFee" required min="0" step="0.01" type="number"
                                placeholder="0,00"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                        </div>
                    </label>

                    <label class="min-w-0 max-w-full overflow-hidden">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Data do empréstimo
                        </span>

                        <input v-model="form.loanDate" required type="date"
                            class="block box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>

                    <label class="min-w-0 max-w-full overflow-hidden">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Início do pagamento
                        </span>

                        <input v-model="form.firstPaymentDate" required type="date"
                            class="block box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>
                </div>
            </section>

            <LoanInstallmentsEditor v-model="form.installments" v-model:overrides="form.installmentOverrides"
                :total="totalWithInterest" :count="form.installmentCount" />
        </form>

        <template #footer>
            <button type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-black/[0.09] bg-white px-4 text-[13px] font-semibold text-black/55 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] sm:min-h-[38px]"
                @click="close">
                Cancelar
            </button>

            <button type="submit" form="loan-form"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#166534] bg-[#166534] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#14532d] active:bg-[#14532d] sm:min-h-[38px]">
                Criar empréstimo
            </button>
        </template>
    </BaseModal>
</template>

<script setup>
import {
    computed,
    reactive,
    watch,
} from 'vue'

import BaseModal from '@/components/base/BaseModal.vue'

import LoanClientSelect from './LoanClientSelect.vue'
import LoanInstallmentsEditor from './LoanInstallmentsEditor.vue'

import { calculateLoanTotal } from '../utils/loanCalculations'

const props = defineProps({
    open: {
        type: Boolean,
        default: false,
    },

    clients: {
        type: Array,
        default: () => [],
    },

    draft: {
        type: Object,
        required: true,
    },
})

const emit = defineEmits([
    'close',
    'save',
    'request-new-client',
    'update:draft',
])

const form = reactive({
    clientId: null,
    amount: null,
    interest: null,
    installmentCount: 1,
    installments: [],
    installmentOverrides: {},
    dailyLateFee: null,
    loanDate: '',
    firstPaymentDate: '',
})

const selectedClient = computed(() =>
    props.clients.find(
        (client) =>
            String(client.id) ===
            String(form.clientId),
    ),
)

const totalWithInterest = computed(() =>
    calculateLoanTotal(
        form.amount,
        form.interest,
    ),
)

const profit = computed(() => {
    const amount =
        Number(form.amount) || 0

    return Math.max(
        totalWithInterest.value - amount,
        0,
    )
})

function formatInputValue(value) {
    return Number(value || 0).toFixed(2)
}

function handleModalModelValue(value) {
    if (!value) {
        close()
    }
}

function close() {
    emit('close')
}

function requestNewClient() {
    emit('update:draft', {
        ...form,

        installments: [
            ...form.installments,
        ],

        installmentOverrides: {
            ...form.installmentOverrides,
        },
    })

    emit('request-new-client')
}

function submit() {
    if (
        !form.clientId ||
        !form.amount ||
        !form.installmentCount ||
        !form.loanDate ||
        !form.firstPaymentDate
    ) {
        return
    }

    emit('save', {
        ...form,

        totalWithInterest:
            totalWithInterest.value,

        profit:
            profit.value,

        installments: [
            ...form.installments,
        ],

        installmentOverrides: {
            ...form.installmentOverrides,
        },
    })
}

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return
        }

        Object.assign(form, {
            clientId:
                props.draft.clientId ??
                null,

            amount:
                props.draft.amount ??
                null,

            interest:
                props.draft.interest ??
                null,

            installmentCount:
                props.draft.installmentCount ??
                1,

            installments: [
                ...(
                    props.draft.installments ??
                    []
                ),
            ],

            installmentOverrides: {
                ...(
                    props.draft.installmentOverrides ??
                    {}
                ),
            },

            dailyLateFee:
                props.draft.dailyLateFee ??
                null,

            loanDate:
                props.draft.loanDate ??
                '',

            firstPaymentDate:
                props.draft.firstPaymentDate ??
                '',
        })
    },
    {
        immediate: true,
    },
)

watch(
    form,
    () => {
        emit('update:draft', {
            ...form,

            installments: [
                ...form.installments,
            ],

            installmentOverrides: {
                ...form.installmentOverrides,
            },
        })
    },
    {
        deep: true,
    },
)
</script>