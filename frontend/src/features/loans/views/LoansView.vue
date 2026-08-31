<template>
    <div class="mx-auto w-full max-w-[1500px]">

        <section class="mt-5 flex items-stretch gap-2 sm:gap-3">
            <div class="relative min-w-0 flex-1">
                <i
                    class="mdi mdi-magnify pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-black/35" />

                <input v-model="search" type="search" placeholder="Buscar por cliente..."
                    class="h-11 w-full rounded-xl border border-black/[0.08] bg-white pl-11 pr-4 text-sm text-[#202124] outline-none transition placeholder:text-black/35 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />
            </div>

            <button type="button"
                class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#166534] px-3.5 text-sm font-medium text-white transition hover:bg-[#14532d] sm:px-4"
                @click="openNewLoan">
                <i class="mdi mdi-plus text-xl" />

                <span class="hidden sm:inline">
                    Novo empréstimo
                </span>
            </button>
        </section>

        <section class="mt-4">
            <div v-if="filteredLoans.length" class="space-y-3">
                <LoanDesktopTable :loans="filteredLoans" />

                <div class="space-y-3 lg:hidden">
                    <LoanMobileCard v-for="loan in filteredLoans" :key="loan.id" :loan="loan" />
                </div>
            </div>

            <div v-else class="rounded-xl border border-dashed border-black/10 bg-white px-5 py-14 text-center">
                <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-black/[0.035]">
                    <i class="mdi mdi-cash-search text-2xl text-black/30" />
                </div>

                <h2 class="mt-3 text-sm font-medium text-[#202124]">
                    Nenhum empréstimo encontrado
                </h2>

                <p class="mt-1 text-sm text-black/40">
                    Tente pesquisar por outro cliente.
                </p>
            </div>
        </section>

        <LoanFormModal :open="isLoanModalOpen" :clients="clients" :draft="loanDraft" @close="closeLoanModal"
            @save="createLoan" @request-new-client="openClientModal" @update:draft="updateLoanDraft" />

        <QuickClientFormModal :open="isClientModalOpen" @close="returnToLoan" @save="createClient" />
    </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import LoanDesktopTable from '../components/LoanDesktopTable.vue'
import LoanFormModal from '../components/LoanFormModal.vue'
import LoanMobileCard from '../components/LoanMobileCard.vue'
import QuickClientFormModal from '../components/QuickClientFormModal.vue'

const search = ref('')
const isLoanModalOpen = ref(false)
const isClientModalOpen = ref(false)

const clients = ref([
    {
        id: 1,
        name: 'João da Silva',
        cpf: '123.456.789-00'
    },
    {
        id: 2,
        name: 'Maria Oliveira Santos',
        cpf: '987.654.321-00'
    },
    {
        id: 3,
        name: 'Carlos Henrique Souza',
        cpf: '456.789.123-00'
    }
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
        daysLate: 0
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
        daysLate: 2
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
        daysLate: 6
    }
])

const createEmptyDraft = () => ({
    clientId: null,
    amount: null,
    interest: null,
    installmentCount: 1,
    installments: [],
    dailyLateFee: null,
    loanDate: '',
    firstPaymentDate: ''
})

const loanDraft = reactive(createEmptyDraft())

const filteredLoans = computed(() => {
    const term = search.value.toLowerCase().trim()

    if (!term) {
        return loans.value
    }

    return loans.value.filter((loan) =>
        loan.clientName.toLowerCase().includes(term)
    )
})

const updateLoanDraft = (draft) => {
    Object.assign(loanDraft, draft)
}

const openNewLoan = () => {
    Object.assign(loanDraft, createEmptyDraft())
    isLoanModalOpen.value = true
}

const closeLoanModal = () => {
    isLoanModalOpen.value = false
}

const openClientModal = () => {
    isLoanModalOpen.value = false
    isClientModalOpen.value = true
}

const returnToLoan = () => {
    isClientModalOpen.value = false
    isLoanModalOpen.value = true
}

const createClient = (client) => {
    const newClient = {
        id: Date.now(),
        ...client
    }

    clients.value.push(newClient)

    loanDraft.clientId = newClient.id

    isClientModalOpen.value = false
    isLoanModalOpen.value = true
}

const createLoan = (loan) => {
    const client = clients.value.find(
        (item) => item.id === loan.clientId
    )

    if (!client) {
        return
    }

    const firstInstallment = loan.installments[0] ?? 0

    loans.value.unshift({
        id: Math.max(...loans.value.map((item) => item.id), 0) + 1,
        clientId: client.id,
        clientName: client.name,
        amount: loan.amount,
        interest: loan.interest,
        totalWithInterest: loan.totalWithInterest,
        installmentCount: loan.installmentCount,
        installmentValue: firstInstallment,
        installments: loan.installments,
        paidInstallments: 0,
        dailyLateFee: loan.dailyLateFee,
        loanDate: loan.loanDate,
        firstPaymentDate: loan.firstPaymentDate,
        status: 'on-time',
        daysLate: 0
    })

    isLoanModalOpen.value = false

    Object.assign(loanDraft, createEmptyDraft())
}
</script>