<template>
    <div class="mx-auto -mt-4 w-full max-w-[1500px] sm:-mt-0">
        <LoansGrid :loans="loans" :search-only="!!fixedStatus" @filter="filters = $event" @open-loan="openLoanInstallments">
            <template v-if="!fixedStatus" #company-filter>
                <CompanySelect v-if="user?.role === 'admin'" v-model="companyFilter" filter class="w-full sm:w-48 sm:shrink-0" />
            </template>
            <template v-if="!fixedStatus" #toolbar-action>
                <button type="button"
                    class="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 text-[13px] font-semibold text-white shadow-sm shadow-[#166534]/10 transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#14532d] hover:shadow-md hover:shadow-[#166534]/15 active:scale-[0.98] sm:w-auto"
                    @click="openNewLoan">
                    <span class="mdi mdi-plus text-lg" aria-hidden="true" />

                    Novo empréstimo
                </button>
            </template>
        </LoansGrid>

        <div ref="target" aria-hidden="true" />

        <LoanFormModal :open="isLoanModalOpen" :clients="clients" :draft="loanDraft" @close="closeLoanModal"
            @save="createLoan" @request-new-client="openClientModal" @update:draft="updateLoanDraft" />

        <ClientFormModal :model-value="isClientModalOpen" :client="null" :initial-company-id="loanDraft.companyId" @update:model-value="setClientModalOpen"
            @save="createClient" @close="returnToLoan" />

        <LoanInstallmentsModal v-model="isInstallmentsModalOpen" :loan="selectedLoan" @close="clearSelectedLoan"
            @confirm-payments="registerLoanPayment" />
    </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import CompanySelect from '@/components/base/CompanySelect.vue'
import { useAuth } from '@/composables/useAuth'
import { useRoute } from 'vue-router'
import ClientFormModal from '@/features/clients/components/ClientFormModal.vue'
import LoanFormModal from '@/features/loans/components/LoanFormModal.vue'
import LoanInstallmentsModal from '@/features/loans/components/LoanInstallmentsModal.vue'
import LoansGrid from '@/features/loans/components/LoansGrid.vue'
import { clientsApi, loansApi } from '@/services/paytrack'
import { toast } from '@/composables/useToast'
import { perform } from '@/services/api'
import { usePagedList } from '@/composables/usePagedList'

const props = defineProps({
  fixedStatus: { type: String, default: '' },
})
const { user } = useAuth()
const companyFilter = ref(null)
const route = useRoute()
const filters = ref({})
const { items: loans, target, reload } = usePagedList(loansApi.list, computed(() => (
  props.fixedStatus
    ? { search: filters.value.search, status: props.fixedStatus }
    : { ...filters.value, company_id: user.value?.role === 'admin' ? companyFilter.value ?? undefined : undefined }
)))
const clients = ref([])
const isLoanModalOpen = ref(false)
const isClientModalOpen = ref(false)
const isInstallmentsModalOpen = ref(false)
const selectedLoan = ref(null)
const createEmptyDraft = () => ({ companyId:null, clientId:null, amount:null, interest:null, installmentCount:1,
  installments:[], installmentOverrides:{}, dailyLateFee:null, loanDate:'', firstPaymentDate:'' })
const loanDraft = reactive(createEmptyDraft())
function updateLoanDraft(draft) { Object.assign(loanDraft, draft) }
function openNewLoan() {
  Object.assign(loanDraft, createEmptyDraft())
  isLoanModalOpen.value = true
}
function closeLoanModal() { isLoanModalOpen.value = false }
function openLoanInstallments(loan) {
  perform(async () => { selectedLoan.value = await loansApi.get(loan.id); isInstallmentsModalOpen.value = true })
}
function clearSelectedLoan() { selectedLoan.value = null }
function openClientModal() { isLoanModalOpen.value = false; isClientModalOpen.value = true }
function setClientModalOpen(value) { if (value) isClientModalOpen.value = true; else returnToLoan() }
function returnToLoan() {
  if (!isClientModalOpen.value) return
  isClientModalOpen.value = false
  isLoanModalOpen.value = true
}
function createClient(form) {
  perform(async () => {
    const client = await clientsApi.save(null, form)
    toast.success('Cliente cadastrado com sucesso.')
    clients.value = [client]
    loanDraft.companyId = client.company_id
    loanDraft.clientId = client.id
    isClientModalOpen.value = false
    isLoanModalOpen.value = true
  })
}
function createLoan(form) {
  perform(async () => {
    await loansApi.create(form)
    toast.success('Empréstimo cadastrado com sucesso.')
    isLoanModalOpen.value = false
    Object.assign(loanDraft, createEmptyDraft())
    await reload()
  })
}
function registerLoanPayment({ loanId, payments }) {
  perform(async () => {
    selectedLoan.value = await loansApi.confirm(loanId, selectedLoan.value.revision, payments)
    toast.success('Pagamentos atualizados com sucesso.')
    isInstallmentsModalOpen.value = false
    await reload()
  })
}
watch(() => route.query.loan, (id) => { if (id) openLoanInstallments({ id }) }, { immediate:true })
</script>
