<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <header
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
            <button
                type="button"
                class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#14532d] sm:h-10 sm:w-auto"
                @click="openCreateModal"
            >
                <span class="mdi mdi-account-plus text-[19px]" />

                Novo cliente
            </button>
        </header>

        <ClientsTable
            class="mt-5"
            :clients="clients"
            @history="openHistoryModal"
            @edit="openEditModal"
            @status="openStatusModal"
        />

        <ClientFormModal
            :model-value="formModalOpen"
            :client="editingClient"
            @update:model-value="setFormModalOpen"
            @save="saveClient"
            @close="closeFormModal"
        />

        <ClientHistoryModal
            :model-value="historyModalOpen"
            :client="selectedClient"
            @update:model-value="setHistoryModalOpen"
            @close="closeHistoryModal"
        />

        <ClientStatusModal
            :model-value="statusModalOpen"
            :client="selectedClient"
            @update:model-value="setStatusModalOpen"
            @save="saveStatus"
            @close="closeStatusModal"
        />
    </div>
</template>

<script setup>
import { ref } from 'vue'

import ClientsTable from '@/features/clients/components/ClientsTable.vue'
import ClientFormModal from '@/features/clients/components/ClientFormModal.vue'
import ClientHistoryModal from '@/features/clients/components/ClientHistoryModal.vue'
import ClientStatusModal from '@/features/clients/components/ClientStatusModal.vue'

const formModalOpen = ref(false)
const historyModalOpen = ref(false)
const statusModalOpen = ref(false)

const editingClient = ref(null)
const selectedClient = ref(null)

const clients = ref([
    {
        id: 1,
        name: 'João da Silva',
        cpf: '123.456.789-00',
        rg: '12.345.678-9',
        phone: '(11) 99999-1234',
        email: 'joao.silva@email.com',
        cnh: '01234567890',
        status: 'ativo',
        loans: [
            {
                id: 24,
                amount: 5000,
                installments: 12,
                status: 'quitado',
                startDate: '2025-03-10',
                endDate: '2026-02-10',
            },
            {
                id: 41,
                amount: 2500,
                installments: 5,
                status: 'ativo',
                startDate: '2026-08-10',
                endDate: null,
            },
        ],
    },
    {
        id: 2,
        name: 'Maria Oliveira Santos',
        cpf: '987.654.321-00',
        rg: '45.678.912-3',
        phone: '(11) 98888-4567',
        email: 'maria.oliveira@email.com',
        cnh: '09876543210',
        status: 'quitado',
        loans: [
            {
                id: 18,
                amount: 3000,
                installments: 6,
                status: 'quitado',
                startDate: '2025-08-15',
                endDate: '2026-01-15',
            },
        ],
    },
    {
        id: 3,
        name: 'Carlos Henrique Souza',
        cpf: '456.789.123-00',
        rg: '33.456.789-1',
        phone: '(11) 97777-8901',
        email: 'carlos.souza@email.com',
        cnh: '04567891234',
        status: 'negativado',
        loans: [
            {
                id: 37,
                amount: 7500,
                installments: 15,
                status: 'negativado',
                startDate: '2026-02-20',
                endDate: null,
            },
        ],
    },
    {
        id: 4,
        name: 'Fernanda Lima Costa',
        cpf: '741.852.963-00',
        rg: '56.789.123-4',
        phone: '(11) 96666-2345',
        email: 'fernanda.lima@email.com',
        cnh: '07418529630',
        status: 'ativo',
        loans: [
            {
                id: 44,
                amount: 4200,
                installments: 10,
                status: 'ativo',
                startDate: '2026-07-05',
                endDate: null,
            },
        ],
    },
    {
        id: 5,
        name: 'Rafael Mendes Rocha',
        cpf: '159.357.486-00',
        rg: '27.369.258-1',
        phone: '(11) 95555-6789',
        email: 'rafael.mendes@email.com',
        cnh: '01593574860',
        status: 'quitado',
        loans: [],
    },
    {
        id: 6,
        name: 'Larissa Martins Alves',
        cpf: '258.369.147-00',
        rg: '38.159.267-5',
        phone: '(11) 94444-1357',
        email: 'larissa.martins@email.com',
        cnh: '02583691470',
        status: 'ativo',
        loans: [],
    },
])

function openCreateModal() {
    editingClient.value = null
    formModalOpen.value = true
}

function openEditModal(client) {
    editingClient.value = client
    formModalOpen.value = true
}

function setFormModalOpen(value) {
    formModalOpen.value = value

    if (!value) {
        editingClient.value = null
    }
}

function closeFormModal() {
    formModalOpen.value = false
    editingClient.value = null
}

function saveClient(form) {
    if (editingClient.value) {
        const index = clients.value.findIndex(
            (client) => client.id === editingClient.value.id,
        )

        if (index !== -1) {
            clients.value[index] = {
                ...clients.value[index],
                ...form,
            }
        }

        closeFormModal()
        return
    }

    const nextId =
        Math.max(
            ...clients.value.map((client) => client.id),
            0,
        ) + 1

    clients.value.unshift({
        id: nextId,
        ...form,
        status: 'ativo',
        loans: [],
    })

    closeFormModal()
}

function openHistoryModal(client) {
    selectedClient.value = client
    historyModalOpen.value = true
}

function setHistoryModalOpen(value) {
    historyModalOpen.value = value

    if (!value) {
        selectedClient.value = null
    }
}

function closeHistoryModal() {
    historyModalOpen.value = false
    selectedClient.value = null
}

function openStatusModal(client) {
    selectedClient.value = client
    statusModalOpen.value = true
}

function setStatusModalOpen(value) {
    statusModalOpen.value = value

    if (!value) {
        selectedClient.value = null
    }
}

function closeStatusModal() {
    statusModalOpen.value = false
    selectedClient.value = null
}

function saveStatus(status) {
    if (!selectedClient.value) {
        return
    }

    const client = clients.value.find(
        (item) => item.id === selectedClient.value.id,
    )

    if (client) {
        client.status = status
    }

    closeStatusModal()
}
</script>