<template>
  <div class="mx-auto -mt-4 w-full max-w-[1500px] sm:-mt-8">
    <ClientsGrid :clients="clients" :status="route.query.status || 'todos'" @filter="filters = $event" @edit="openEditModal" @history="openHistoryModal" @status="openStatusModal">
      <template #toolbar-action>
        <button type="button"
          class="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 text-[13px] font-semibold text-white shadow-sm shadow-[#166534]/10 transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#14532d] hover:shadow-md hover:shadow-[#166534]/15 active:scale-[0.98] sm:w-auto"
          @click="openCreateModal">
          <span class="mdi mdi-plus text-lg" aria-hidden="true" />

          Novo cliente
        </button>
      </template>
    </ClientsGrid>

    <div ref="target" aria-hidden="true" />

    <ClientFormModal :model-value="formModalOpen" :client="editingClient" @update:model-value="setFormModalOpen"
      @save="saveClient" @close="closeFormModal" />

    <ClientHistoryModal :model-value="historyModalOpen" :client="selectedClient"
      @update:model-value="setHistoryModalOpen" @close="closeHistoryModal" />

    <ClientStatusModal :model-value="statusModalOpen" :client="selectedClient" @update:model-value="setStatusModalOpen"
      @save="saveStatus" @close="closeStatusModal" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ClientFormModal from '@/features/clients/components/ClientFormModal.vue'
import ClientHistoryModal from '@/features/clients/components/ClientHistoryModal.vue'
import ClientStatusModal from '@/features/clients/components/ClientStatusModal.vue'
import ClientsGrid from '@/features/clients/components/ClientsGrid.vue'
import { clientsApi } from '@/services/paytrack'
import { perform } from '@/services/api'
import { usePagedList } from '@/composables/usePagedList'

const route = useRoute()
const filters = ref({ status:route.query.status })
watch(() => route.query.status, status => { filters.value = { status } })
const { items: clients, target, reload } = usePagedList(clientsApi.list, computed(() => filters.value))
const formModalOpen = ref(false)
const historyModalOpen = ref(false)
const statusModalOpen = ref(false)
const editingClient = ref(null)
const selectedClient = ref(null)
function openCreateModal() { editingClient.value = null; formModalOpen.value = true }
function openEditModal(client) { editingClient.value = client; formModalOpen.value = true }
function setFormModalOpen(value) { formModalOpen.value = value; if (!value) editingClient.value = null }
function closeFormModal() { setFormModalOpen(false) }
function saveClient(form) {
  perform(async () => {
    await clientsApi.save(editingClient.value?.id, form)
    closeFormModal()
    await reload()
  })
}
function openHistoryModal(client) {
  perform(async () => { selectedClient.value = await clientsApi.get(client.id); historyModalOpen.value = true })
}
function setHistoryModalOpen(value) { historyModalOpen.value = value; if (!value) selectedClient.value = null }
function closeHistoryModal() { setHistoryModalOpen(false) }
function openStatusModal(client) { selectedClient.value = client; statusModalOpen.value = true }
function setStatusModalOpen(value) { statusModalOpen.value = value; if (!value) selectedClient.value = null }
function closeStatusModal() { setStatusModalOpen(false) }
function saveStatus(status) {
  perform(async () => {
    await clientsApi.save(selectedClient.value.id, { status })
    closeStatusModal()
    await reload()
  })
}
</script>
