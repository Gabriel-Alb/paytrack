<template>
    <BaseTable :columns="columns" :items="filteredClients" min-width="1120px"
        mobile-container-class="space-y-3 bg-[#f6f7f6] p-3">
        <template #toolbar>
            <div
                class="flex flex-col gap-3 border-b border-black/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div class="relative min-w-0 flex-1 sm:max-w-[430px]">
                    <span
                        class="mdi mdi-magnify pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[19px] text-black/30" />

                    <input v-model="search" type="search" placeholder="Buscar cliente..."
                        class="h-10 w-full rounded-lg border border-black/[0.08] bg-white pl-10 pr-3.5 text-sm text-[#202124] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-black/30 focus:border-[#166534]/45 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]" />
                </div>

                <div class="relative w-full sm:w-[185px]">
                    <select v-model="statusFilter"
                        class="h-10 w-full appearance-none rounded-lg border border-black/[0.08] bg-white px-3.5 pr-10 text-sm text-[#202124] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#166534]/45 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]">
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
        </template>

        <template #cell-name="{ item }">
            <p class="min-w-[165px] truncate text-sm font-medium text-[#202124]">
                {{ item.name }}
            </p>
        </template>

        <template #cell-cpf="{ item }">
            <span class="whitespace-nowrap text-[13px] text-black/50">
                {{ item.cpf }}
            </span>
        </template>

        <template #cell-rg="{ item }">
            <span class="whitespace-nowrap text-[13px] text-black/50">
                {{ item.rg || '—' }}
            </span>
        </template>

        <template #cell-phone="{ item }">
            <span class="whitespace-nowrap text-[13px] text-black/50">
                {{ item.phone }}
            </span>
        </template>

        <template #cell-email="{ item }">
            <p class="max-w-[205px] truncate text-[13px] text-black/50" :title="item.email">
                {{ item.email || '—' }}
            </p>
        </template>

        <template #cell-cnh="{ item }">
            <span class="whitespace-nowrap text-[13px] text-black/50">
                {{ item.cnh || '—' }}
            </span>
        </template>

        <template #cell-status="{ item }">
            <span :class="[
                'inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                getStatusClasses(item.status),
            ]">
                {{ getStatusLabel(item.status) }}
            </span>
        </template>

        <template #cell-actions="{ item }">
            <div class="flex items-center justify-end gap-1.5">
                <button type="button"
                    class="group inline-flex size-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#166534] transition-[background-color,border-color,transform] duration-150 hover:border-[#166534]/20 hover:bg-[#166534]/[0.055] active:scale-[0.94]"
                    title="Histórico" :aria-label="`Histórico de ${item.name}`" @click="emit('history', item)">
                    <span class="mdi mdi-history text-[18px] transition-transform duration-150 group-hover:scale-105" />
                </button>

                <button type="button"
                    class="group inline-flex size-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#166534] transition-[background-color,border-color,transform] duration-150 hover:border-[#166534]/20 hover:bg-[#166534]/[0.055] active:scale-[0.94]"
                    title="Editar" :aria-label="`Editar ${item.name}`" @click="emit('edit', item)">
                    <span class="mdi mdi-pencil text-[17px] transition-transform duration-150 group-hover:scale-105" />
                </button>

                <button type="button"
                    class="group inline-flex size-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#166534] transition-[background-color,border-color,transform] duration-150 hover:border-[#166534]/20 hover:bg-[#166534]/[0.055] active:scale-[0.94]"
                    title="Alterar status" :aria-label="`Alterar status de ${item.name}`" @click="emit('status', item)">
                    <span
                        class="mdi mdi-account-star text-[18px] transition-transform duration-150 group-hover:scale-105" />
                </button>
            </div>
        </template>

        <template #mobile-item="{ item }">
            <article class="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
                <div class="p-4">
                    <div class="flex min-w-0 items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-[15px] font-semibold text-[#202124]">
                                {{ item.name }}
                            </p>

                            <p class="mt-1 text-xs text-black/40">
                                {{ item.cpf }}
                            </p>
                        </div>

                        <span :class="[
                            'inline-flex shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold',
                            getStatusClasses(item.status),
                        ]">
                            {{ getStatusLabel(item.status) }}
                        </span>
                    </div>

                    <div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-black/[0.05] pt-4">
                        <div class="min-w-0">
                            <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.045em] text-black/30">
                                RG
                            </p>

                            <p class="truncate text-xs font-medium text-black/60">
                                {{ item.rg || '—' }}
                            </p>
                        </div>

                        <div class="min-w-0">
                            <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.045em] text-black/30">
                                CNH
                            </p>

                            <p class="truncate text-xs font-medium text-black/60">
                                {{ item.cnh || '—' }}
                            </p>
                        </div>

                        <div class="min-w-0">
                            <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.045em] text-black/30">
                                Telefone
                            </p>

                            <p class="truncate text-xs font-medium text-black/60">
                                {{ item.phone }}
                            </p>
                        </div>

                        <div class="min-w-0">
                            <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.045em] text-black/30">
                                E-mail
                            </p>

                            <p class="truncate text-xs font-medium text-black/60">
                                {{ item.email || '—' }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-3 divide-x divide-black/[0.06] border-t border-black/[0.06] bg-[#fcfcfc]">
                    <button type="button"
                        class="flex min-h-14 flex-col items-center justify-center gap-[0.2rem] px-1 py-[0.45rem] text-[10px] font-semibold text-black/50 transition-colors active:bg-[#166534]/[0.06] active:text-[#166534]"
                        @click="emit('history', item)">
                        <span class="mdi mdi-history text-[1.2rem] text-[#166534]" />

                        <span>
                            Histórico
                        </span>
                    </button>

                    <button type="button"
                        class="flex min-h-14 flex-col items-center justify-center gap-[0.2rem] px-1 py-[0.45rem] text-[10px] font-semibold text-black/50 transition-colors active:bg-[#166534]/[0.06] active:text-[#166534]"
                        @click="emit('edit', item)">
                        <span class="mdi mdi-pencil text-[1.2rem] text-[#166534]" />

                        <span>
                            Editar
                        </span>
                    </button>

                    <button type="button"
                        class="flex min-h-14 flex-col items-center justify-center gap-[0.2rem] px-1 py-[0.45rem] text-[10px] font-semibold text-black/50 transition-colors active:bg-[#166534]/[0.06] active:text-[#166534]"
                        @click="emit('status', item)">
                        <span class="mdi mdi-account-star text-[1.2rem] text-[#166534]" />

                        <span>
                            Status
                        </span>
                    </button>
                </div>
            </article>
        </template>

        <template #empty>
            <div class="flex min-h-[330px] flex-col items-center justify-center px-5 text-center">
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
        </template>
    </BaseTable>
</template>

<script setup>
import {
    computed,
    ref,
} from 'vue'

import BaseTable from '@/components/base/BaseTable.vue'

const props = defineProps({
    clients: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits([
    'history',
    'edit',
    'status',
])

const search = ref('')
const statusFilter = ref('todos')

const columns = [
    {
        key: 'name',
        label: 'Cliente',
        headerClass: 'px-5 py-3.5',
        cellClass: 'px-5 py-4',
    },
    {
        key: 'cpf',
        label: 'CPF',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'rg',
        label: 'RG',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'phone',
        label: 'Telefone',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'email',
        label: 'E-mail',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'cnh',
        label: 'CNH',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'status',
        label: 'Status',
        headerClass: 'px-4 py-3.5',
        cellClass: 'px-4 py-4',
    },
    {
        key: 'actions',
        label: 'Ações',
        headerClass: 'w-[130px] px-5 py-3.5 text-right',
        cellClass: 'px-5 py-4',
    },
]

const filteredClients = computed(() => {
    const term = search.value
        .trim()
        .toLowerCase()

    return props.clients.filter((client) => {
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
</script>