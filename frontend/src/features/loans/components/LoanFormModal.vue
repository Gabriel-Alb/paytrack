<template>
    <Teleport to="body">
        <Transition name="modal-backdrop">
            <div v-if="open" class="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" @click="close" />
        </Transition>

        <Transition name="loan-modal">
            <div v-if="open"
                class="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-5">
                <div class="pointer-events-auto flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-[820px] sm:rounded-2xl"
                    :style="sheetStyle">
                    <button type="button" class="flex w-full touch-none justify-center pb-2 pt-3 sm:hidden"
                        @pointerdown="startDrag">
                        <span class="h-1.5 w-11 rounded-full bg-black/15" />
                    </button>

                    <header
                        class="flex items-start justify-between gap-4 border-b border-black/[0.06] px-5 pb-4 pt-2 sm:p-5">
                        <div>
                            <h2 class="text-lg font-semibold text-[#202124]">
                                Novo empréstimo
                            </h2>

                            <p class="mt-1 text-sm text-black/45">
                                Preencha as condições combinadas com o cliente.
                            </p>
                        </div>

                        <button type="button"
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/[0.04] hover:text-black/65"
                            @click="close">
                            <i class="mdi mdi-close text-xl" />
                        </button>
                    </header>

                    <form class="min-h-0 flex-1 overflow-y-auto" @submit.prevent="submit">
                        <div class="space-y-6 p-5">
                            <section>
                                <div class="grid gap-3 sm:grid-cols-[1fr_260px]">
                                    <LoanClientSelect v-model="form.clientId" :clients="clients" />

                                    <div
                                        class="flex items-center gap-3 rounded-xl border border-[#166534]/10 bg-[#166534]/[0.035] p-3">
                                        <div
                                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#166534]/10 text-[#166534]">
                                            <i class="mdi mdi-account-plus-outline text-xl" />
                                        </div>

                                        <div class="min-w-0">
                                            <p class="text-xs text-black/50">
                                                Cliente não cadastrado?
                                            </p>

                                            <button type="button"
                                                class="mt-0.5 text-left text-sm font-semibold text-[#166534] hover:underline"
                                                @click="requestNewClient">
                                                Cadastrar novo cliente
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <label v-if="selectedClient" class="mt-4 block">
                                    <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                        Nome
                                    </span>

                                    <input :value="selectedClient.name" readonly type="text"
                                        class="h-11 w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 text-sm text-[#202124] outline-none transition" />
                                </label>
                            </section>

                            <section>
                                <div class="mb-4">
                                    <h3 class="text-sm font-semibold text-[#202124]">
                                        Condições do empréstimo
                                    </h3>

                                    <p class="mt-1 text-xs text-black/45">
                                        Defina o valor, juros e parcelamento.
                                    </p>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Valor emprestado
                                        </span>

                                        <div class="relative">
                                            <span
                                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                                R$
                                            </span>

                                            <input v-model.number="form.amount" required min="0" step="0.01"
                                                type="number"
                                                class="h-11 w-full rounded-lg border border-black/10 bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                                placeholder="0,00" />
                                        </div>
                                    </label>

                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Juros
                                        </span>

                                        <div class="relative">
                                            <input v-model.number="form.interest" required min="0" step="0.01"
                                                type="number"
                                                class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 pr-10 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                                placeholder="0" />

                                            <span
                                                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                                %
                                            </span>
                                        </div>
                                    </label>

                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Valor com juros
                                        </span>

                                        <div class="relative">
                                            <span
                                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                                R$
                                            </span>

                                            <input :value="totalWithInterest.toFixed(2)" readonly type="number"
                                                class="h-11 w-full rounded-lg border border-black/10 bg-[#166534]/[0.025] pl-10 pr-3 text-sm font-semibold text-[#166534] outline-none" />
                                        </div>
                                    </label>

                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Quantidade de parcelas
                                        </span>

                                        <input v-model.number="form.installmentCount" required min="1" max="120"
                                            type="number"
                                            class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                            placeholder="1" />
                                    </label>

                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Multa por dia de atraso
                                        </span>

                                        <div class="relative">
                                            <span
                                                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">
                                                R$
                                            </span>

                                            <input v-model.number="form.dailyLateFee" required min="0" step="0.01"
                                                type="number"
                                                class="h-11 w-full rounded-lg border border-black/10 bg-white pl-10 pr-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                                placeholder="0,00" />
                                        </div>
                                    </label>
                                </div>
                            </section>

                            <LoanInstallmentsEditor v-model="form.installments" :total="totalWithInterest"
                                :count="form.installmentCount" />

                            <section>
                                <div class="mb-4">
                                    <h3 class="text-sm font-semibold text-[#202124]">
                                        Datas
                                    </h3>

                                    <p class="mt-1 text-xs text-black/45">
                                        Informe quando o empréstimo foi feito e
                                        quando os pagamentos começam.
                                    </p>
                                </div>

                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Data do empréstimo
                                        </span>

                                        <input v-model="form.loanDate" required type="date"
                                            class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                                    </label>

                                    <label>
                                        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                            Início do pagamento
                                        </span>

                                        <input v-model="form.firstPaymentDate" required type="date"
                                            class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
                                    </label>
                                </div>
                            </section>
                        </div>

                        <footer
                            class="sticky bottom-0 flex gap-3 border-t border-black/[0.06] bg-white p-4 sm:justify-end sm:px-5">
                            <button type="button"
                                class="h-11 flex-1 rounded-lg border border-black/10 px-5 text-sm font-medium text-[#202124] transition hover:bg-black/[0.03] sm:flex-none"
                                @click="close">
                                Cancelar
                            </button>

                            <button type="submit"
                                class="h-11 flex-1 rounded-lg bg-[#166534] px-6 text-sm font-medium text-white transition hover:bg-[#14532d] sm:flex-none">
                                Criar empréstimo
                            </button>
                        </footer>
                    </form>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import LoanClientSelect from './LoanClientSelect.vue'
import LoanInstallmentsEditor from './LoanInstallmentsEditor.vue'
import { calculateLoanTotal } from '../utils/loanCalculations'
import { useBottomSheetDrag } from '../composables/useBottomSheetDrag'

const props = defineProps({
    open: {
        type: Boolean,
        default: false
    },
    clients: {
        type: Array,
        default: () => []
    },
    draft: {
        type: Object,
        required: true
    }
})

const emit = defineEmits([
    'close',
    'save',
    'request-new-client',
    'update:draft'
])

const form = reactive({
    clientId: null,
    amount: null,
    interest: null,
    installmentCount: 1,
    installments: [],
    dailyLateFee: null,
    loanDate: '',
    firstPaymentDate: ''
})

const selectedClient = computed(() =>
    props.clients.find((client) => client.id === form.clientId)
)

const totalWithInterest = computed(() =>
    calculateLoanTotal(form.amount, form.interest)
)

const close = () => {
    emit('close')
}

const { sheetStyle, startDrag } = useBottomSheetDrag(close)

const requestNewClient = () => {
    emit('update:draft', {
        ...form,
        installments: [...form.installments]
    })

    emit('request-new-client')
}

const submit = () => {
    if (!form.clientId) {
        return
    }

    emit('save', {
        ...form,
        totalWithInterest: totalWithInterest.value,
        installments: [...form.installments]
    })
}

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return
        }

        Object.assign(form, {
            clientId: props.draft.clientId ?? null,
            amount: props.draft.amount ?? null,
            interest: props.draft.interest ?? null,
            installmentCount: props.draft.installmentCount ?? 1,
            installments: [...(props.draft.installments ?? [])],
            dailyLateFee: props.draft.dailyLateFee ?? null,
            loanDate: props.draft.loanDate ?? '',
            firstPaymentDate: props.draft.firstPaymentDate ?? ''
        })
    },
    { immediate: true }
)

watch(
    form,
    () => {
        emit('update:draft', {
            ...form,
            installments: [...form.installments]
        })
    },
    { deep: true }
)
</script>

<style scoped>
.modal-backdrop-enter-active,
.modal-backdrop-leave-active {
    transition: opacity 220ms ease;
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
    opacity: 0;
}

.loan-modal-enter-active,
.loan-modal-leave-active {
    transition:
        opacity 220ms ease,
        transform 220ms ease;
}

.loan-modal-enter-from,
.loan-modal-leave-to {
    opacity: 0;
    transform: translateY(16px);
}
</style>