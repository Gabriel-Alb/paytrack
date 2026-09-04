<template>
    <section class="mt-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <div class="relative w-full sm:max-w-[360px]">
                    <input v-model="search" type="text" placeholder="Pesquisar por nome ou CPF"
                        class="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-4 pr-10 text-[13px] text-[#27272a] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#a1a1aa] focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]" />

                    <span
                        class="mdi mdi-magnify pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#a1a1aa]"
                        aria-hidden="true" />
                </div>

                <div class="relative w-full sm:w-[180px]">
                    <select v-model="statusFilter"
                        class="h-10 w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-3 pr-9 text-[13px] font-medium text-[#52525b] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]">
                        <option value="todos">
                            Todos os status
                        </option>

                        <option value="ativo">
                            Ativo
                        </option>

                        <option value="quitado">
                            Quitado
                        </option>

                        <option value="negativado">
                            Negativado
                        </option>
                    </select>

                    <span
                        class="mdi mdi-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#71717a]"
                        aria-hidden="true" />
                </div>
            </div>

            <div class="w-full shrink-0 sm:w-auto">
                <slot name="toolbar-action" />
            </div>
        </div>

        <div v-if="filteredClients.length" class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BaseInfoCard v-for="client in filteredClients" :key="client.id">
                <div class="flex min-w-0 items-start justify-between gap-4">
                    <div class="min-w-0">
                        <h3 class="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#27272a]">
                            {{ client.name }}
                        </h3>

                        <p class="mt-1 text-[12px] text-[#8b8b93]">
                            CPF: {{ client.cpf }}
                        </p>
                    </div>

                    <span class="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]"
                        :class="statusClasses(client.status)">
                        {{ statusLabel(client.status) }}
                    </span>
                </div>

                <div class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                    <div class="min-w-0">
                        <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                            Telefone
                        </p>

                        <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                            {{ client.phone || 'Não informado' }}
                        </p>
                    </div>

                    <div class="min-w-0">
                        <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                            E-mail
                        </p>

                        <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]" :title="client.email">
                            {{ client.email || 'Não informado' }}
                        </p>
                    </div>

                    <div class="min-w-0">
                        <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                            RG
                        </p>

                        <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                            {{ client.rg || 'Não informado' }}
                        </p>
                    </div>

                    <div class="min-w-0">
                        <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">
                            CNH
                        </p>

                        <p class="mt-1 truncate text-[13px] font-medium text-[#3f3f46]">
                            {{ client.cnh || 'Não informado' }}
                        </p>
                    </div>
                </div>

                <div class="mt-5 flex items-center justify-between gap-4 border-t border-black/[0.06] pt-4">
                    <div class="min-w-0">
                        <p class="text-[11px] text-[#a1a1aa]">
                            {{ loanLabel(client.loans?.length ?? 0) }}
                        </p>
                    </div>

                    <div class="flex shrink-0 items-center gap-1.5">
                        <button type="button"
                            class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-[background-color,color,transform] duration-200 hover:bg-[#f4f4f5] hover:text-[#27272a] active:scale-95"
                            :aria-label="`Editar ${client.name}`" title="Editar" @click="$emit('edit', client)">
                            <span class="mdi mdi-pencil text-[18px]" aria-hidden="true" />
                        </button>

                        <button type="button"
                            class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-[background-color,color,transform] duration-200 hover:bg-[#f4f4f5] hover:text-[#27272a] active:scale-95"
                            :aria-label="`Histórico de ${client.name}`" title="Histórico"
                            @click="$emit('history', client)">
                            <span class="mdi mdi-history text-[18px]" aria-hidden="true" />
                        </button>

                        <button type="button"
                            class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-[background-color,color,transform] duration-200 hover:bg-[#edf7ef] hover:text-[#166534] active:scale-95"
                            :aria-label="`Alterar status de ${client.name}`" title="Status"
                            @click="$emit('status', client)">
                            <span class="mdi mdi-account-star text-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </BaseInfoCard>
        </div>

        <div v-else
            class="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.09] bg-white px-6 text-center">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#71717a]">
                <span class="mdi mdi-account-search-outline text-[22px]" aria-hidden="true" />
            </div>

            <h3 class="mt-4 text-sm font-semibold text-[#27272a]">
                Nenhum cliente encontrado
            </h3>

            <p class="mt-1 max-w-sm text-xs leading-5 text-[#8b8b93]">
                Tente alterar os filtros ou pesquisar utilizando outro nome ou CPF.
            </p>
        </div>
    </section>
</template>

<script setup>
import { computed, ref } from 'vue'

import BaseInfoCard from '@/components/base/BaseInfoCard.vue'

const props = defineProps({
    clients: {
        type: Array,
        default: () => [],
    },
})

defineEmits(['edit', 'history', 'status'])

const search = ref('')
const statusFilter = ref('todos')

const filteredClients = computed(() => {
    const normalizedSearch = search.value.trim().toLowerCase()

    return props.clients.filter((client) => {
        const matchesStatus =
            statusFilter.value === 'todos' ||
            client.status === statusFilter.value

        if (!normalizedSearch) {
            return matchesStatus
        }

        const name = client.name?.toLowerCase() ?? ''
        const cpf = client.cpf?.toLowerCase() ?? ''

        return (
            matchesStatus &&
            (
                name.includes(normalizedSearch) ||
                cpf.includes(normalizedSearch)
            )
        )
    })
})

function statusLabel(status) {
    const labels = {
        ativo: 'Ativo',
        quitado: 'Quitado',
        negativado: 'Negativado',
    }

    return labels[status] ?? status
}

function statusClasses(status) {
    const classes = {
        ativo: 'bg-[#166534] text-white',
        quitado: 'bg-[#2563eb] text-white',
        negativado: 'bg-[#dc2626] text-white',
    }

    return classes[status] ?? 'bg-[#52525b] text-white'
}

function loanLabel(amount) {
    if (amount === 0) {
        return 'Nenhum empréstimo'
    }

    if (amount === 1) {
        return '1 empréstimo'
    }

    return `${amount} empréstimos`
}
</script>