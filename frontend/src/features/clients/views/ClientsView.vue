<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">


            <button type="button"
                class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#14532d] sm:h-10 sm:w-auto"
                @click="openCreateModal">
                <span class="mdi mdi-account-plus text-[19px]" />
                Novo cliente
            </button>
        </header>

        <section class="mt-5 overflow-hidden rounded-xl border border-black/[0.07] bg-white">
            <div
                class="flex flex-col gap-3 border-b border-black/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div class="relative min-w-0 flex-1 sm:max-w-[430px]">
                    <span
                        class="mdi mdi-magnify pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[19px] text-black/30" />

                    <input v-model="search" type="search" placeholder="Buscar cliente..." class="filter-input pl-10" />
                </div>

                <div class="relative w-full sm:w-[185px]">
                    <select v-model="statusFilter" class="filter-input appearance-none pr-10">
                        <option value="todos">
                            Todos os status
                        </option>

                        <option value="ativo">
                            Ativos
                        </option>

                        <option value="quitado">
                            Quitados
                        </option>

                        <option value="negativado">
                            Negativados
                        </option>
                    </select>

                    <span
                        class="mdi mdi-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-black/30" />
                </div>
            </div>

            <div v-if="filteredClients.length" class="hidden overflow-x-auto md:block">
                <table class="w-full min-w-[1240px] border-collapse">
                    <thead>
                        <tr
                            class="border-b border-black/[0.06] bg-[#fafafa] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-black/35">
                            <th class="px-5 py-3.5">
                                Cliente
                            </th>

                            <th class="px-4 py-3.5">
                                CPF
                            </th>

                            <th class="px-4 py-3.5">
                                RG
                            </th>

                            <th class="px-4 py-3.5">
                                Telefone
                            </th>

                            <th class="px-4 py-3.5">
                                E-mail
                            </th>

                            <th class="px-4 py-3.5">
                                CNH
                            </th>

                            <th class="px-4 py-3.5">
                                Status
                            </th>

                            <th class="w-[260px] px-5 py-3.5 text-right">
                                Ações
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="client in filteredClients" :key="client.id"
                            class="border-b border-black/[0.05] transition-colors last:border-b-0 hover:bg-[#166534]/[0.018]">
                            <td class="px-5 py-4">
                                <p class="min-w-[165px] truncate text-sm font-medium text-[#202124]">
                                    {{ client.name }}
                                </p>
                            </td>

                            <td class="table-cell">
                                {{ client.cpf }}
                            </td>

                            <td class="table-cell">
                                {{ client.rg || '—' }}
                            </td>

                            <td class="table-cell">
                                {{ client.phone }}
                            </td>

                            <td class="max-w-[205px] truncate px-4 py-4 text-[13px] text-black/50"
                                :title="client.email">
                                {{ client.email || '—' }}
                            </td>

                            <td class="table-cell">
                                {{ client.cnh || '—' }}
                            </td>

                            <td class="px-4 py-4">
                                <span :class="[
                                    'inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                                    getStatusClasses(client.status),
                                ]">
                                    {{ getStatusLabel(client.status) }}
                                </span>
                            </td>

                            <td class="px-5 py-4">
                                <div class="flex items-center justify-end gap-1.5">
                                    <button type="button" class="desktop-action" title="Histórico"
                                        @click="openHistoryModal(client)">
                                        <span class="mdi mdi-history text-[18px]" />
                                        Histórico
                                    </button>

                                    <button type="button" class="desktop-action" title="Editar"
                                        @click="openEditModal(client)">
                                        <span class="mdi mdi-pencil text-[17px]" />
                                        Editar
                                    </button>

                                    <button type="button" class="desktop-action" title="Alterar status"
                                        @click="openStatusModal(client)">
                                        <span class="mdi mdi-account-star text-[18px]" />
                                        Status
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="filteredClients.length" class="space-y-3 bg-[#f6f7f6] p-3 md:hidden">
                <article v-for="client in filteredClients" :key="client.id"
                    class="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
                    <div class="p-4">
                        <div class="flex min-w-0 items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-[15px] font-semibold text-[#202124]">
                                    {{ client.name }}
                                </p>

                                <p class="mt-1 text-xs text-black/40">
                                    {{ client.cpf }}
                                </p>
                            </div>

                            <span :class="[
                                'inline-flex shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold',
                                getStatusClasses(client.status),
                            ]">
                                {{ getStatusLabel(client.status) }}
                            </span>
                        </div>

                        <div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-black/[0.05] pt-4">
                            <div class="min-w-0">
                                <p class="mobile-label">
                                    RG
                                </p>

                                <p class="mobile-value">
                                    {{ client.rg || '—' }}
                                </p>
                            </div>

                            <div class="min-w-0">
                                <p class="mobile-label">
                                    CNH
                                </p>

                                <p class="mobile-value">
                                    {{ client.cnh || '—' }}
                                </p>
                            </div>

                            <div class="min-w-0">
                                <p class="mobile-label">
                                    Telefone
                                </p>

                                <p class="mobile-value">
                                    {{ client.phone }}
                                </p>
                            </div>

                            <div class="min-w-0">
                                <p class="mobile-label">
                                    E-mail
                                </p>

                                <p class="mobile-value truncate">
                                    {{ client.email || '—' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-3 divide-x divide-black/[0.06] border-t border-black/[0.06] bg-[#fcfcfc]">
                        <button type="button" class="mobile-action" @click="openHistoryModal(client)">
                            <span class="mdi mdi-history" />
                            <span>Histórico</span>
                        </button>

                        <button type="button" class="mobile-action" @click="openEditModal(client)">
                            <span class="mdi mdi-pencil" />
                            <span>Editar</span>
                        </button>

                        <button type="button" class="mobile-action" @click="openStatusModal(client)">
                            <span class="mdi mdi-account-star" />
                            <span>Status</span>
                        </button>
                    </div>
                </article>
            </div>

            <div v-if="!filteredClients.length"
                class="flex min-h-[330px] flex-col items-center justify-center px-5 text-center">
                <div class="flex size-11 items-center justify-center rounded-xl bg-[#166534]/[0.08] text-[#166534]">
                    <span class="mdi mdi-account-search text-[23px]" />
                </div>

                <p class="mt-3 text-sm font-semibold text-[#202124]">
                    Nenhum cliente encontrado
                </p>

                <p class="mt-1 max-w-[270px] text-xs leading-5 text-black/35">
                    Tente alterar sua busca ou selecionar outro status.
                </p>
            </div>
        </section>

        <Teleport to="body">
            <Transition name="sheet">
                <div v-if="formModalOpen" class="sheet-backdrop" :class="{
                    'sheet-backdrop-dragging': sheetDragging,
                }" :style="sheetBackdropStyle" @mousedown.self="closeFormModal">
                    <div class="sheet-panel sm:max-w-[590px]" :class="{
                        'sheet-panel-dragging': sheetDragging,
                        'sheet-panel-dismissing': sheetDismissing,
                    }" :style="sheetPanelStyle">
                        <div class="sheet-drag-area" @pointerdown="
                            startSheetDrag($event, closeFormModal)
                            " @pointermove="moveSheetDrag" @pointerup="endSheetDrag" @pointercancel="cancelSheetDrag">
                            <div class="sheet-handle" />
                        </div>

                        <header class="sheet-header">
                            <div class="min-w-0">
                                <h2 class="text-base font-semibold text-[#202124]">
                                    {{
                                        editingClient
                                            ? 'Editar cliente'
                                            : 'Novo cliente'
                                    }}
                                </h2>

                                <p class="mt-1 text-xs text-black/40">
                                    {{
                                        editingClient
                                            ? 'Atualize os dados cadastrais.'
                                            : 'Preencha as informações do novo cliente.'
                                    }}
                                </p>
                            </div>

                            <button type="button" class="sheet-close" @click="closeFormModal">
                                <span class="mdi mdi-close text-[21px]" />
                            </button>
                        </header>

                        <form id="client-form" class="sheet-content" @submit.prevent="saveClient">
                            <div class="grid gap-4 sm:grid-cols-2">
                                <label class="sm:col-span-2">
                                    <span class="form-label">
                                        Nome completo
                                    </span>

                                    <input v-model.trim="form.name" type="text" required placeholder="Nome do cliente"
                                        class="form-input" />
                                </label>

                                <label>
                                    <span class="form-label">
                                        CPF
                                    </span>

                                    <input v-model.trim="form.cpf" type="text" required placeholder="000.000.000-00"
                                        class="form-input" />
                                </label>

                                <label>
                                    <span class="form-label">
                                        RG
                                    </span>

                                    <input v-model.trim="form.rg" type="text" placeholder="00.000.000-0"
                                        class="form-input" />
                                </label>

                                <label>
                                    <span class="form-label">
                                        Telefone
                                    </span>

                                    <input v-model.trim="form.phone" type="tel" required placeholder="(11) 99999-9999"
                                        class="form-input" />
                                </label>

                                <label>
                                    <span class="form-label">
                                        CNH
                                    </span>

                                    <input v-model.trim="form.cnh" type="text" placeholder="Número da CNH"
                                        class="form-input" />
                                </label>

                                <label class="sm:col-span-2">
                                    <span class="form-label">
                                        E-mail
                                    </span>

                                    <input v-model.trim="form.email" type="email" placeholder="cliente@email.com"
                                        class="form-input" />
                                </label>
                            </div>
                        </form>

                        <footer class="sheet-footer">
                            <button type="button" class="secondary-button" @click="closeFormModal">
                                Cancelar
                            </button>

                            <button type="submit" form="client-form" class="primary-button">
                                {{
                                    editingClient
                                        ? 'Salvar alterações'
                                        : 'Cadastrar cliente'
                                }}
                            </button>
                        </footer>
                    </div>
                </div>
            </Transition>

            <Transition name="sheet">
                <div v-if="historyModalOpen && selectedClient" class="sheet-backdrop" :class="{
                    'sheet-backdrop-dragging': sheetDragging,
                }" :style="sheetBackdropStyle" @mousedown.self="closeHistoryModal">
                    <div class="sheet-panel sm:max-w-[620px]" :class="{
                        'sheet-panel-dragging': sheetDragging,
                        'sheet-panel-dismissing': sheetDismissing,
                    }" :style="sheetPanelStyle">
                        <div class="sheet-drag-area" @pointerdown="
                            startSheetDrag($event, closeHistoryModal)
                            " @pointermove="moveSheetDrag" @pointerup="endSheetDrag" @pointercancel="cancelSheetDrag">
                            <div class="sheet-handle" />
                        </div>

                        <header class="sheet-header">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="mdi mdi-history text-[20px] text-[#166534]" />

                                    <h2 class="text-base font-semibold text-[#202124]">
                                        Histórico
                                    </h2>
                                </div>

                                <p class="mt-1 truncate text-xs text-black/40">
                                    {{ selectedClient.name }}
                                </p>
                            </div>

                            <button type="button" class="sheet-close" @click="closeHistoryModal">
                                <span class="mdi mdi-close text-[21px]" />
                            </button>
                        </header>

                        <div class="sheet-content bg-[#f7f7f7]">
                            <template v-if="selectedClient.loans.length">
                                <div class="space-y-3">
                                    <article v-for="loan in selectedClient.loans" :key="loan.id"
                                        class="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
                                        <div class="p-4">
                                            <div class="flex items-start justify-between gap-3">
                                                <div>
                                                    <p class="text-[11px] font-medium text-black/35">
                                                        Empréstimo #{{
                                                            String(
                                                                loan.id,
                                                            ).padStart(4, '0')
                                                        }}
                                                    </p>

                                                    <p class="mt-1 text-lg font-semibold text-[#202124]">
                                                        {{
                                                            formatCurrency(
                                                                loan.amount,
                                                            )
                                                        }}
                                                    </p>
                                                </div>

                                                <span :class="[
                                                    'inline-flex shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold',
                                                    getStatusClasses(
                                                        loan.status,
                                                    ),
                                                ]">
                                                    {{
                                                        getStatusLabel(
                                                            loan.status,
                                                        )
                                                    }}
                                                </span>
                                            </div>

                                            <div
                                                class="mt-4 grid grid-cols-2 gap-3 border-t border-black/[0.05] pt-4 sm:grid-cols-3">
                                                <div>
                                                    <p class="history-label">
                                                        Parcelas
                                                    </p>

                                                    <p class="history-value">
                                                        {{
                                                            loan.installments
                                                        }}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p class="history-label">
                                                        Início
                                                    </p>

                                                    <p class="history-value">
                                                        {{
                                                            formatDate(
                                                                loan.startDate,
                                                            )
                                                        }}
                                                    </p>
                                                </div>

                                                <div class="col-span-2 sm:col-span-1">
                                                    <p class="history-label">
                                                        Término
                                                    </p>

                                                    <p class="history-value">
                                                        {{
                                                            loan.endDate
                                                                ? formatDate(
                                                                    loan.endDate,
                                                                )
                                                                : 'Em aberto'
                                                        }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                </div>
                            </template>

                            <div v-else class="flex min-h-[260px] flex-col items-center justify-center text-center">
                                <div
                                    class="flex size-12 items-center justify-center rounded-xl bg-[#166534]/[0.08] text-[#166534]">
                                    <span class="mdi mdi-history text-[24px]" />
                                </div>

                                <p class="mt-3 text-sm font-semibold text-[#202124]">
                                    Nenhum empréstimo
                                </p>

                                <p class="mt-1 max-w-[250px] text-xs leading-5 text-black/40">
                                    Este cliente ainda não possui histórico de
                                    empréstimos.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>

            <Transition name="sheet">
                <div v-if="statusModalOpen && selectedClient" class="sheet-backdrop" :class="{
                    'sheet-backdrop-dragging': sheetDragging,
                }" :style="sheetBackdropStyle" @mousedown.self="closeStatusModal">
                    <div class="sheet-panel sm:max-w-[460px]" :class="{
                        'sheet-panel-dragging': sheetDragging,
                        'sheet-panel-dismissing': sheetDismissing,
                    }" :style="sheetPanelStyle">
                        <div class="sheet-drag-area" @pointerdown="
                            startSheetDrag($event, closeStatusModal)
                            " @pointermove="moveSheetDrag" @pointerup="endSheetDrag" @pointercancel="cancelSheetDrag">
                            <div class="sheet-handle" />
                        </div>

                        <header class="sheet-header">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="mdi mdi-account-star text-[21px] text-[#166534]" />

                                    <h2 class="text-base font-semibold text-[#202124]">
                                        Alterar status
                                    </h2>
                                </div>

                                <p class="mt-1 truncate text-xs text-black/40">
                                    {{ selectedClient.name }}
                                </p>
                            </div>

                            <button type="button" class="sheet-close" @click="closeStatusModal">
                                <span class="mdi mdi-close text-[21px]" />
                            </button>
                        </header>

                        <div class="sheet-content">
                            <p class="mb-3 text-xs font-medium text-black/45">
                                Escolha o novo status
                            </p>

                            <div class="space-y-2">
                                <button v-for="status in statusOptions" :key="status.value" type="button" :class="[
                                    'status-option',
                                    newStatus === status.value
                                        ? 'status-option-selected'
                                        : '',
                                ]" @click="newStatus = status.value">
                                    <div :class="[
                                        'status-radio',
                                        newStatus === status.value
                                            ? 'status-radio-selected'
                                            : '',
                                    ]">
                                        <span v-if="newStatus === status.value" class="mdi mdi-check text-[17px]" />
                                    </div>

                                    <div class="min-w-0 flex-1">
                                        <p :class="[
                                            'text-sm font-semibold',
                                            newStatus === status.value
                                                ? 'text-[#166534]'
                                                : 'text-[#202124]',
                                        ]">
                                            {{ status.label }}
                                        </p>

                                        <p class="mt-0.5 text-xs leading-4 text-black/35">
                                            {{ status.description }}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <footer class="sheet-footer">
                            <button type="button" class="secondary-button" @click="closeStatusModal">
                                Cancelar
                            </button>

                            <button type="button" class="primary-button" @click="saveStatus">
                                Salvar status
                            </button>
                        </footer>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
import {
    computed,
    onBeforeUnmount,
    reactive,
    ref,
} from 'vue'

const search = ref('')
const statusFilter = ref('todos')

const formModalOpen = ref(false)
const historyModalOpen = ref(false)
const statusModalOpen = ref(false)

const editingClient = ref(null)
const selectedClient = ref(null)
const newStatus = ref('ativo')

const sheetDragY = ref(0)
const sheetDragging = ref(false)
const sheetDismissing = ref(false)

let sheetDragStartY = 0
let sheetLastY = 0
let sheetLastTime = 0
let sheetVelocity = 0
let sheetPointerId = null
let sheetDragTarget = null
let sheetCloseHandler = null
let sheetResetTimer = null

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

const form = reactive({
    name: '',
    cpf: '',
    rg: '',
    phone: '',
    email: '',
    cnh: '',
})

const statusOptions = [
    {
        value: 'ativo',
        label: 'Ativo',
        description: 'Cliente ativo e liberado no sistema.',
    },
    {
        value: 'quitado',
        label: 'Quitado',
        description: 'Cliente sem pendências financeiras.',
    },
    {
        value: 'negativado',
        label: 'Negativado',
        description: 'Cliente com restrição ou pendência financeira.',
    },
]

const filteredClients = computed(() => {
    const term = search.value.trim().toLowerCase()

    return clients.value.filter((client) => {
        const matchesStatus =
            statusFilter.value === 'todos' ||
            client.status === statusFilter.value

        if (!matchesStatus) {
            return false
        }

        if (!term) {
            return true
        }

        return [
            client.name,
            client.cpf,
            client.rg,
            client.phone,
            client.email,
            client.cnh,
        ].some((value) =>
            String(value ?? '')
                .toLowerCase()
                .includes(term),
        )
    })
})

const sheetPanelStyle = computed(() => ({
    '--sheet-drag-y': `${sheetDragY.value}px`,
}))

const sheetBackdropStyle = computed(() => {
    const viewportHeight =
        typeof window !== 'undefined'
            ? window.innerHeight
            : 800

    const progress = Math.min(
        sheetDragY.value / (viewportHeight * 0.45),
        1,
    )

    return {
        '--sheet-backdrop-opacity': String(
            0.3 * (1 - progress),
        ),
    }
})

function isMobileSheet() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 639px)').matches
    )
}

function resetSheetDrag() {
    if (sheetResetTimer) {
        clearTimeout(sheetResetTimer)
        sheetResetTimer = null
    }

    sheetDragY.value = 0
    sheetDragging.value = false
    sheetDismissing.value = false

    sheetDragStartY = 0
    sheetLastY = 0
    sheetLastTime = 0
    sheetVelocity = 0
    sheetPointerId = null
    sheetDragTarget = null
    sheetCloseHandler = null
}

function releaseSheetPointer() {
    if (
        !sheetDragTarget ||
        sheetPointerId === null
    ) {
        return
    }

    try {
        if (
            sheetDragTarget.hasPointerCapture?.(
                sheetPointerId,
            )
        ) {
            sheetDragTarget.releasePointerCapture(
                sheetPointerId,
            )
        }
    } catch {
        return
    }
}

function startSheetDrag(event, closeHandler) {
    if (
        !isMobileSheet() ||
        sheetDismissing.value
    ) {
        return
    }

    sheetDragging.value = true
    sheetCloseHandler = closeHandler

    sheetPointerId = event.pointerId
    sheetDragTarget = event.currentTarget

    sheetDragStartY = event.clientY
    sheetLastY = event.clientY
    sheetLastTime = performance.now()
    sheetVelocity = 0

    sheetDragTarget.setPointerCapture?.(
        event.pointerId,
    )
}

function moveSheetDrag(event) {
    if (!sheetDragging.value) {
        return
    }

    const now = performance.now()
    const deltaY = event.clientY - sheetDragStartY
    const elapsed = now - sheetLastTime

    if (elapsed > 0) {
        sheetVelocity =
            (event.clientY - sheetLastY) /
            elapsed
    }

    sheetLastY = event.clientY
    sheetLastTime = now

    if (deltaY <= 0) {
        sheetDragY.value = Math.max(
            -10,
            deltaY * 0.08,
        )
        return
    }

    sheetDragY.value = deltaY
}

function endSheetDrag(event) {
    if (!sheetDragging.value) {
        return
    }

    const now = performance.now()

    const finalDistance = Math.max(
        0,
        event.clientY - sheetDragStartY,
    )

    const elapsed = now - sheetLastTime

    if (elapsed > 0 && elapsed < 80) {
        sheetVelocity =
            (event.clientY - sheetLastY) /
            elapsed
    }

    sheetDragY.value = finalDistance

    releaseSheetPointer()

    sheetDragging.value = false

    const viewportHeight = window.innerHeight

    const closeDistance = Math.min(
        150,
        viewportHeight * 0.2,
    )

    const fastSwipe =
        finalDistance >= 40 &&
        sheetVelocity >= 0.65

    const shouldClose =
        finalDistance >= closeDistance ||
        fastSwipe

    if (!shouldClose) {
        sheetDragY.value = 0
        sheetCloseHandler = null
        sheetDragTarget = null
        sheetPointerId = null
        return
    }

    sheetDismissing.value = true

    const closeHandler = sheetCloseHandler

    sheetDragY.value = viewportHeight

    sheetResetTimer = setTimeout(() => {
        closeHandler?.()

        setTimeout(() => {
            resetSheetDrag()
        }, 20)
    }, 190)
}

function cancelSheetDrag() {
    if (!sheetDragging.value) {
        return
    }

    releaseSheetPointer()

    sheetDragging.value = false
    sheetDragY.value = 0

    sheetPointerId = null
    sheetDragTarget = null
    sheetCloseHandler = null
}

function openCreateModal() {
    resetSheetDrag()
    editingClient.value = null
    resetForm()
    formModalOpen.value = true
}

function openEditModal(client) {
    resetSheetDrag()

    editingClient.value = client

    Object.assign(form, {
        name: client.name,
        cpf: client.cpf,
        rg: client.rg,
        phone: client.phone,
        email: client.email,
        cnh: client.cnh,
    })

    formModalOpen.value = true
}

function closeFormModal() {
    formModalOpen.value = false
    editingClient.value = null
    resetForm()

    if (!sheetDismissing.value) {
        resetSheetDrag()
    }
}

function saveClient() {
    if (editingClient.value) {
        const index = clients.value.findIndex(
            (client) =>
                client.id === editingClient.value.id,
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
            ...clients.value.map(
                (client) => client.id,
            ),
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
    resetSheetDrag()
    selectedClient.value = client
    historyModalOpen.value = true
}

function closeHistoryModal() {
    historyModalOpen.value = false
    selectedClient.value = null

    if (!sheetDismissing.value) {
        resetSheetDrag()
    }
}

function openStatusModal(client) {
    resetSheetDrag()
    selectedClient.value = client
    newStatus.value = client.status
    statusModalOpen.value = true
}

function closeStatusModal() {
    statusModalOpen.value = false
    selectedClient.value = null

    if (!sheetDismissing.value) {
        resetSheetDrag()
    }
}

function saveStatus() {
    if (!selectedClient.value) {
        return
    }

    const client = clients.value.find(
        (item) =>
            item.id === selectedClient.value.id,
    )

    if (client) {
        client.status = newStatus.value
    }

    closeStatusModal()
}

function resetForm() {
    Object.assign(form, {
        name: '',
        cpf: '',
        rg: '',
        phone: '',
        email: '',
        cnh: '',
    })
}

function getStatusLabel(status) {
    const labels = {
        ativo: 'Ativo',
        quitado: 'Quitado',
        negativado: 'Negativado',
    }

    return labels[status] ?? status
}

function getStatusClasses(status) {
    const classes = {
        ativo: 'border-[#166534]/15 bg-[#166534]/[0.07] text-[#166534]',
        quitado: 'border-black/[0.08] bg-black/[0.04] text-black/50',
        negativado: 'border-red-700/10 bg-red-50 text-red-700',
    }

    return (
        classes[status] ??
        'border-black/[0.08] bg-black/[0.04] text-black/50'
    )
}

const currencyFormatter = new Intl.NumberFormat(
    'pt-BR',
    {
        style: 'currency',
        currency: 'BRL',
    },
)

const dateFormatter = new Intl.DateTimeFormat(
    'pt-BR',
    {
        timeZone: 'UTC',
    },
)

function formatCurrency(value) {
    return currencyFormatter.format(value)
}

function formatDate(value) {
    return dateFormatter.format(
        new Date(`${value}T00:00:00Z`),
    )
}

onBeforeUnmount(() => {
    if (sheetResetTimer) {
        clearTimeout(sheetResetTimer)
    }
})
</script>

<style scoped>
.table-cell {
    padding: 1rem;
    color: rgb(0 0 0 / 0.5);
    font-size: 0.8125rem;
    white-space: nowrap;
}

.filter-input {
    width: 100%;
    height: 2.5rem;
    padding-left: 0.875rem;
    padding-right: 0.875rem;
    border: 1px solid rgb(0 0 0 / 0.08);
    border-radius: 0.5rem;
    background: #fff;
    color: #202124;
    font-size: 0.875rem;
    outline: none;
    transition:
        border-color 150ms ease,
        box-shadow 150ms ease;
}

.filter-input::placeholder {
    color: rgb(0 0 0 / 0.3);
}

.filter-input:focus {
    border-color: rgb(22 101 52 / 0.45);
    box-shadow: 0 0 0 3px rgb(22 101 52 / 0.08);
}

.desktop-action {
    display: inline-flex;
    height: 2rem;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0 0.625rem;
    border: 1px solid rgb(0 0 0 / 0.08);
    border-radius: 0.4rem;
    background: #fff;
    color: rgb(0 0 0 / 0.55);
    font-size: 0.6875rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
        color 150ms ease,
        border-color 150ms ease,
        background-color 150ms ease;
}

.desktop-action .mdi {
    color: #166534;
}

.desktop-action:hover {
    border-color: rgb(22 101 52 / 0.22);
    background: rgb(22 101 52 / 0.055);
    color: #166534;
}

.mobile-label {
    margin-bottom: 0.25rem;
    color: rgb(0 0 0 / 0.32);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.045em;
    text-transform: uppercase;
}

.mobile-value {
    overflow: hidden;
    color: rgb(0 0 0 / 0.58);
    font-size: 0.75rem;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mobile-action {
    display: flex;
    min-height: 3.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    padding: 0.45rem 0.2rem;
    color: rgb(0 0 0 / 0.5);
    font-size: 0.65rem;
    font-weight: 600;
    transition:
        color 150ms ease,
        background-color 150ms ease;
}

.mobile-action .mdi {
    color: #166534;
    font-size: 1.2rem;
}

.mobile-action:active {
    background: rgb(22 101 52 / 0.06);
    color: #166534;
}

.sheet-backdrop {
    --sheet-backdrop-opacity: 0.3;

    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(0 0 0 / var(--sheet-backdrop-opacity));
    backdrop-filter: blur(2px);
    transition:
        opacity 180ms ease,
        background-color 180ms ease;
}

.sheet-backdrop-dragging {
    transition: none;
}

.sheet-panel {
    display: flex;
    width: 100%;
    max-height: 92dvh;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.25rem 1.25rem 0 0;
    background: #fff;
    box-shadow: 0 -10px 35px rgb(0 0 0 / 0.12);
    transform: translate3d(0,
            var(--sheet-drag-y, 0px),
            0);
    transition:
        transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
}

.sheet-panel-dragging {
    transition: none;
}

.sheet-panel-dismissing {
    transition:
        transform 200ms cubic-bezier(0.4, 0, 1, 1);
}

.sheet-drag-area {
    display: flex;
    width: 100%;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.sheet-drag-area:active {
    cursor: grabbing;
}

.sheet-handle {
    width: 3rem;
    height: 0.3rem;
    border-radius: 9999px;
    background: rgb(0 0 0 / 0.18);
    transition:
        width 160ms ease,
        background-color 160ms ease,
        transform 160ms ease;
}

.sheet-drag-area:active .sheet-handle {
    width: 3.25rem;
    background: rgb(22 101 52 / 0.38);
    transform: scaleY(1.05);
}

.sheet-header {
    display: flex;
    flex-shrink: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem 1rem;
    border-bottom: 1px solid rgb(0 0 0 / 0.06);
    background: #fff;
}

.sheet-close {
    display: flex;
    width: 2.25rem;
    height: 2.25rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    color: rgb(0 0 0 / 0.4);
}

.sheet-close:active {
    background: rgb(0 0 0 / 0.05);
}

.sheet-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
}

.sheet-footer {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding:
        0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    border-top: 1px solid rgb(0 0 0 / 0.06);
    background: #fff;
}

.sheet-footer.single-action {
    display: block;
}

.form-label {
    display: block;
    margin-bottom: 0.375rem;
    color: rgb(0 0 0 / 0.5);
    font-size: 0.75rem;
    font-weight: 500;
}

.form-input {
    width: 100%;
    height: 2.875rem;
    padding: 0 0.75rem;
    border: 1px solid rgb(0 0 0 / 0.09);
    border-radius: 0.625rem;
    background: #f8f8f8;
    color: #202124;
    font-size: 1rem;
    outline: none;
    transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        background-color 150ms ease;
}

.form-input::placeholder {
    color: rgb(0 0 0 / 0.28);
}

.form-input:focus {
    border-color: rgb(22 101 52 / 0.45);
    background: #fff;
    box-shadow: 0 0 0 3px rgb(22 101 52 / 0.08);
}

.primary-button,
.secondary-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.625rem;
    padding: 0 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
}

.primary-button {
    border: 1px solid #166534;
    background: #166534;
    color: #fff;
}

.primary-button:active {
    background: #14532d;
}

.secondary-button {
    border: 1px solid rgb(0 0 0 / 0.09);
    background: #fff;
    color: rgb(0 0 0 / 0.55);
}

.history-label {
    color: rgb(0 0 0 / 0.32);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.history-value {
    margin-top: 0.25rem;
    color: rgb(0 0 0 / 0.6);
    font-size: 0.75rem;
    font-weight: 600;
}

.status-option {
    display: flex;
    width: 100%;
    min-height: 4rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid rgb(0 0 0 / 0.08);
    border-radius: 0.75rem;
    background: #fff;
    text-align: left;
    transition:
        border-color 150ms ease,
        background-color 150ms ease;
}

.status-option-selected {
    border-color: rgb(22 101 52 / 0.3);
    background: rgb(22 101 52 / 0.055);
}

.status-radio {
    display: flex;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgb(0 0 0 / 0.16);
    border-radius: 9999px;
    color: #fff;
}

.status-radio-selected {
    border-color: #166534;
    background: #166534;
}

.sheet-enter-active,
.sheet-leave-active {
    transition: opacity 180ms ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
    transition:
        transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-enter-from,
.sheet-leave-to {
    opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
    transform: translate3d(0, 100%, 0);
}

@media (min-width: 640px) {
    .sheet-backdrop {
        align-items: center;
        padding: 1rem;
    }

    .sheet-panel {
        max-height: 88dvh;
        border-radius: 1rem;
        box-shadow: 0 20px 60px rgb(0 0 0 / 0.14);
        transform: none;
    }

    .sheet-drag-area {
        display: none;
    }

    .sheet-header {
        padding: 1rem 1.5rem;
    }

    .sheet-content {
        padding: 1.25rem 1.5rem;
    }

    .sheet-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 1rem 1.5rem;
    }

    .sheet-footer.single-action {
        display: flex;
    }

    .primary-button,
    .secondary-button {
        min-height: 2.375rem;
    }

    .form-input {
        height: 2.5rem;
        font-size: 0.875rem;
    }

    .sheet-enter-from .sheet-panel,
    .sheet-leave-to .sheet-panel {
        transform: translateY(24px);
    }
}

@media (prefers-reduced-motion: reduce) {

    .sheet-backdrop,
    .sheet-panel,
    .sheet-handle,
    .sheet-enter-active,
    .sheet-leave-active,
    .sheet-enter-active .sheet-panel,
    .sheet-leave-active .sheet-panel {
        transition: none;
    }
}
</style>