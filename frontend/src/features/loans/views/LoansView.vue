<template>
    <div class="mx-auto -mt-4 w-full max-w-[1500px] sm:-mt-0">
        <LoansGrid :loans="loans">
            <template #toolbar-action>
                <button type="button"
                    class="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 text-[13px] font-semibold text-white shadow-sm shadow-[#166534]/10 transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#14532d] hover:shadow-md hover:shadow-[#166534]/15 active:scale-[0.98] sm:w-auto"
                    @click="openNewLoan">
                    <span class="mdi mdi-plus text-lg" aria-hidden="true" />

                    Novo empréstimo
                </button>
            </template>
        </LoansGrid>

        <LoanFormModal :open="isLoanModalOpen" :clients="clients" :draft="loanDraft" @close="closeLoanModal"
            @save="createLoan" @request-new-client="openClientModal" @update:draft="updateLoanDraft" />

        <ClientFormModal :model-value="isClientModalOpen" :client="null" @update:model-value="setClientModalOpen"
            @save="createClient" @close="returnToLoan" />
    </div>
</template>

<script setup>
import {
    reactive,
    ref,
} from 'vue'

import ClientFormModal from '@/features/clients/components/ClientFormModal.vue'
import LoanFormModal from '@/features/loans/components/LoanFormModal.vue'
import LoansGrid from '@/features/loans/components/LoansGrid.vue'

const isLoanModalOpen = ref(false)
const isClientModalOpen = ref(false)

const clients = ref([
    {
        id: 1,
        name: 'João da Silva',
        cpf: '123.456.789-00',
        status: 'ativo',
    },
    {
        id: 2,
        name: 'Maria Oliveira Santos',
        cpf: '987.654.321-00',
        status: 'quitado',
    },
    {
        id: 3,
        name: 'Carlos Henrique Souza',
        cpf: '456.789.123-00',
        status: 'negativado',
    },
])

const loans = ref([
    {
        id: 48,
        clientId: 1,
        clientName: 'João da Silva',
        amount: 5000,
        interest: 12,
        installmentCount: 12,
        installmentValue: 466.67,
        paidInstallments: 7,
        status: 'on-time',
        daysLate: 0,
    },
    {
        id: 47,
        clientId: 2,
        clientName: 'Maria Oliveira Santos',
        amount: 2500,
        interest: 10,
        installmentCount: 5,
        installmentValue: 550,
        paidInstallments: 2,
        status: 'attention',
        daysLate: 2,
    },
    {
        id: 46,
        clientId: 3,
        clientName: 'Carlos Henrique Souza',
        amount: 10000,
        interest: 15,
        installmentCount: 10,
        installmentValue: 1150,
        paidInstallments: 3,
        status: 'overdue',
        daysLate: 6,
    },
])

const createEmptyDraft = () => ({
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

const loanDraft = reactive(
    createEmptyDraft(),
)

function updateLoanDraft(draft) {
    Object.assign(
        loanDraft,
        draft,
    )
}

function openNewLoan() {
    Object.assign(
        loanDraft,
        createEmptyDraft(),
    )

    isLoanModalOpen.value = true
}

function closeLoanModal() {
    isLoanModalOpen.value = false
}

function openClientModal() {
    isLoanModalOpen.value = false
    isClientModalOpen.value = true
}

function setClientModalOpen(value) {
    if (value) {
        isClientModalOpen.value = true
        return
    }

    returnToLoan()
}

function returnToLoan() {
    if (!isClientModalOpen.value) {
        return
    }

    isClientModalOpen.value = false
    isLoanModalOpen.value = true
}

function createClient(form) {
    const nextId =
        Math.max(
            ...clients.value.map(
                (client) => client.id,
            ),
            0,
        ) + 1

    const newClient = {
        id: nextId,
        ...form,
        status: 'sem_contrato',
        loans: [],
    }

    clients.value.push(
        newClient,
    )

    loanDraft.clientId =
        newClient.id

    isClientModalOpen.value = false
    isLoanModalOpen.value = true
}

function createLoan(loan) {
    const client =
        clients.value.find(
            (item) =>
                item.id === loan.clientId,
        )

    if (!client) {
        return
    }

    const nextId =
        Math.max(
            ...loans.value.map(
                (item) => item.id,
            ),
            0,
        ) + 1

    loans.value.unshift({
        id: nextId,

        clientId:
            client.id,

        clientName:
            client.name,

        amount:
            loan.amount,

        interest:
            loan.interest,

        totalWithInterest:
            loan.totalWithInterest,

        profit:
            loan.profit,

        installmentCount:
            loan.installmentCount,

        installmentValue:
            loan.installments?.[0] ?? 0,

        installments:
            [...loan.installments],

        installmentOverrides: {
            ...(
                loan.installmentOverrides ??
                {}
            ),
        },

        paidInstallments: 0,

        dailyLateFee:
            loan.dailyLateFee,

        loanDate:
            loan.loanDate,

        firstPaymentDate:
            loan.firstPaymentDate,

        status: 'on-time',

        daysLate: 0,
    })

    client.status = 'ativo'

    isLoanModalOpen.value = false

    Object.assign(
        loanDraft,
        createEmptyDraft(),
    )
}
</script>