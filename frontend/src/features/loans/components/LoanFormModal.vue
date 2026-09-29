<template>
    <BaseModal :model-value="open" :title="loan ? 'Editar empréstimo' : 'Novo empréstimo'"
        :description="loan ? 'Atualize as condições combinadas com o cliente.' : 'Preencha as condições combinadas com o cliente.'"
        panel-class="sm:max-w-[860px]" content-class="overflow-x-hidden touch-pan-y" :close-on-backdrop="false"
        @update:model-value="handleModalModelValue">
        <form id="loan-form" class="w-full min-w-0 max-w-full space-y-7 overflow-x-hidden" @submit.prevent="submit"
            @keydown.enter.prevent>
            <fieldset v-if="!loan || user?.role === 'admin'" :disabled="saving"><CompanySelect v-model="form.companyId" :active="open" /></fieldset>
            <fieldset :disabled="saving" class="min-w-0">

                <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <LoanClientSelect v-model="form.clientId" :clients="clients" :company-id="clientCompanyId"
                        @select-client="selectedClient = $event"
                        @request-new-client="requestNewClient" />

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            CPF
                        </span>

                        <div class="relative min-w-0">
                            <input :value="selectedClient?.cpf ?? ''" readonly type="text"
                                placeholder="Selecione um cliente"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.08] bg-[#f4f4f5] px-3 pr-9 text-sm text-[#71717a] outline-none placeholder:text-black/40" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#71717a]"
                                aria-hidden="true" />
                        </div>
                    </label>
                </div>
            </fieldset>

            <fieldset :disabled="saving" class="min-w-0">

                <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Valor emprestado
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/50">
                                R$
                            </span>

                            <input v-model.number="form.amount" required min="0.01" step="0.01" type="number"
                                placeholder="0,00"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/45 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Juros
                        </span>

                        <div class="relative min-w-0">
                            <input v-model.number="form.interest" required min="0" step="0.01" type="number"
                                placeholder="0"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white px-3 pr-10 text-sm text-[#202124] outline-none transition placeholder:text-black/45 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />

                            <span
                                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/50">
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
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717a]">
                                R$
                            </span>

                            <input :value="formatInputValue(totalWithInterest)" readonly type="text"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.08] bg-[#f4f4f5] pl-10 pr-9 text-sm font-semibold text-[#52525b] outline-none" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#71717a]"
                                aria-hidden="true" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Lucro
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717a]">
                                R$
                            </span>

                            <input :value="formatInputValue(profit)" readonly type="text"
                                class="box-border h-11 w-full min-w-0 max-w-full cursor-not-allowed rounded-lg border border-black/[0.08] bg-[#f4f4f5] pl-10 pr-9 text-sm font-semibold text-[#166534] outline-none" />

                            <span
                                class="mdi mdi-lock-outline pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-[#71717a]"
                                aria-hidden="true" />
                        </div>
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Quantidade de parcelas
                        </span>

                        <input v-model.number="form.installmentCount" required min="1" max="120" type="number"
                            placeholder="1"
                            class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/45 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>

                    <label class="min-w-0">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Multa por dia de atraso
                        </span>

                        <div class="relative min-w-0">
                            <span
                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/50">
                                R$
                            </span>

                            <input v-model.number="form.dailyLateFee" required min="0" step="0.01" type="number"
                                placeholder="0,00"
                                class="box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/45 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                        </div>
                    </label>

                    <label class="min-w-0 max-w-full overflow-hidden">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Data do empréstimo
                        </span>

                        <input v-model="form.loanDate" required type="date"
                            class="block box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>

                    <label class="min-w-0 max-w-full overflow-hidden">
                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                            Início do pagamento
                        </span>

                        <input v-model="form.firstPaymentDate" required type="date"
                            class="block box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-black/[0.12] bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                    </label>
                </div>
            </fieldset>

            <fieldset :disabled="saving">
                <LoanInstallmentsEditor v-model="form.installments" v-model:overrides="form.installmentOverrides"
                    :total="totalWithInterest" :count="form.installmentCount" />
            </fieldset>
        </form>

        <template #footer>
            <button type="button" :disabled="saving"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-black/[0.09] bg-white px-4 text-[13px] font-semibold text-black/55 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] sm:min-h-[38px]"
                @click="close">
                Cancelar
            </button>

            <button type="submit" form="loan-form" :disabled="saving"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#166534] bg-[#166534] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#14532d] active:bg-[#14532d] sm:min-h-[38px]">
                {{ saving ? 'Salvando…' : loan ? 'Salvar alterações' : 'Criar empréstimo' }}
            </button>
        </template>
    </BaseModal>
</template>

<script setup>
import {
    computed,
    reactive,
    ref,
    watch,
} from 'vue'

import CompanySelect from '@/components/base/CompanySelect.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import { useAuth } from '@/composables/useAuth'

import LoanClientSelect from './LoanClientSelect.vue'
import LoanInstallmentsEditor from './LoanInstallmentsEditor.vue'

import { toCents, fromCents } from '@/services/paytrack'
import { calculateLoanTotal } from '../utils/loanCalculations'

const props = defineProps({
    loan: { type:Object, default:null },
    saving: Boolean,
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
    companyId: null,
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

const selectedClient = ref(null)
const { user } = useAuth()
const clientCompanyId = computed(() => props.loan && user.value?.role === 'admin' ? form.companyId : null)

watch(() => form.companyId, (companyId, previous) => {
    if (props.open && previous != null && companyId !== previous && props.loan && user.value?.role === 'admin') {
        form.clientId = null
        selectedClient.value = null
    }
})

const totalWithInterest = computed(() =>
    calculateLoanTotal(
        form.amount,
        form.interest,
    ),
)

const profit = computed(() => {
    try { return fromCents(Math.max(toCents(totalWithInterest.value) - toCents(form.amount), 0)) }
    catch { return '0.00' }
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
    if (!props.saving) emit('close')
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
    if (props.saving) return
    if (
        !form.companyId ||
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
            companyId: props.draft.companyId ?? null,
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
