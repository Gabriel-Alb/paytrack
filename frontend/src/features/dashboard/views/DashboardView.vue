<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <section class="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard v-for="card in summaryCards" :key="card.title" v-bind="card" />
        </section>

        <article class="mt-4 rounded-xl border border-black/[0.07] bg-white p-4 sm:mt-5 sm:p-6">
            <header class="flex items-start justify-between gap-4">
                <div>
                    <h2 class="text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        Recebimentos
                    </h2>

                    <p class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs">
                        Valores recebidos nos últimos sete dias
                    </p>
                </div>

                <span
                    class="shrink-0 rounded-md bg-[#edf7ef] px-2 py-1 text-[9px] font-semibold text-[#166534] sm:text-[10px]">
                    Esta semana
                </span>
            </header>

            <div class="mt-6">
                <div class="relative h-[190px]">
                    <div aria-hidden="true" class="absolute inset-0 flex flex-col justify-between">
                        <span v-for="line in 5" :key="line" class="border-t border-dashed border-black/[0.06]" />
                    </div>

                    <div class="absolute inset-0 flex items-end justify-between gap-2 px-1 sm:gap-5 sm:px-3">
                        <div v-for="item in receiptChart" :key="item.label"
                            class="flex h-full min-w-0 flex-1 flex-col justify-end">
                            <div class="group relative flex flex-1 items-end justify-center">
                                <div :title="`${item.label}: ${item.value}`" :style="{ height: `${item.percentage}%` }"
                                    :class="[
                                        'w-full max-w-[42px] rounded-t-md transition-all duration-300 hover:opacity-80',
                                        item.highlight
                                            ? 'bg-[#166534]'
                                            : 'bg-[#a8d56f]',
                                    ]" />
                            </div>

                            <span class="mt-2 text-center text-[9px] font-medium text-[#8b8b93] sm:text-[10px]">
                                {{ item.label }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </article>

        <section class="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
            <article class="min-w-0 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
                <header class="flex items-center justify-between gap-2">
                    <h2 class="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-[15px]">
                        Resumo da carteira
                    </h2>

                </header>

                <div class="mt-5 space-y-4">
                    <div v-for="item in portfolioSummary" :key="item.label">
                        <div class="flex items-center justify-between gap-2">
                            <span class="truncate text-[9px] font-medium text-[#71717a] sm:text-[11px]">
                                {{ item.label }}
                            </span>

                            <span class="shrink-0 text-[9px] font-semibold text-[#3f3f46] sm:text-[11px]">
                                {{ item.value }}
                            </span>
                        </div>

                        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0f0f1]">
                            <div :style="{ width: `${item.percentage}%` }"
                                :class="['h-full rounded-full', item.color]" />
                        </div>
                    </div>
                </div>
            </article>

            <article class="min-w-0 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
                <header class="flex items-center justify-between gap-2">
                    <h2 class="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-[15px]">
                        Próximos pagamentos
                    </h2>

                </header>

                <div class="mt-4 divide-y divide-black/[0.06]">
                    <button v-for="payment in upcomingPayments" :key="payment.name" type="button"
                        class="flex w-full items-center gap-2 py-3 text-left transition-opacity hover:opacity-70">
                        <div
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeedff] text-[9px] font-semibold text-[#5b5790]">
                            {{ payment.initials }}
                        </div>

                        <div class="min-w-0 flex-1">
                            <p class="truncate text-[10px] font-semibold text-[#3f3f46] sm:text-xs">
                                {{ payment.name }}
                            </p>

                            <p class="mt-0.5 truncate text-[8px] text-[#a1a1aa] sm:text-[10px]">
                                {{ payment.date }}
                            </p>
                        </div>

                        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-[#a1a1aa]" aria-hidden="true">
                            <path :d="mdiChevronRight" fill="currentColor" />
                        </svg>
                    </button>
                </div>
            </article>
        </section>

    </div>
</template>

<script setup>
import {
    mdiAccountPlusOutline,
    mdiCalendarClock,
    mdiCashCheck,
    mdiCashPlus,
    mdiChartLine,
    mdiChevronRight,
    mdiWalletOutline,
} from '@mdi/js'

import SummaryCard from '../components/SummaryCard.vue'

const summaryCards = [
    {
        title: 'Carteira ativa',
        value: 'R$ 48.500,00',
        description: '32 empréstimos ativos',
        indicator: '+12,5%',
        status: 'positive',
    },
    {
        title: 'Recebido no mês',
        value: 'R$ 18.720,00',
        description: '74 pagamentos confirmados',
        indicator: '+8,2%',
        status: 'positive',
    },
]

const receiptChart = [
    {
        label: 'Seg',
        value: 'R$ 1.850,00',
        percentage: 42,
    },
    {
        label: 'Ter',
        value: 'R$ 3.200,00',
        percentage: 68,
    },
    {
        label: 'Qua',
        value: 'R$ 1.420,00',
        percentage: 34,
    },
    {
        label: 'Qui',
        value: 'R$ 3.650,00',
        percentage: 78,
        highlight: true,
    },
    {
        label: 'Sex',
        value: 'R$ 2.100,00',
        percentage: 49,
    },
    {
        label: 'Sáb',
        value: 'R$ 4.200,00',
        percentage: 90,
        highlight: true,
    },
    {
        label: 'Dom',
        value: 'R$ 1.280,00',
        percentage: 29,
    },
]

const portfolioSummary = [
    {
        label: 'Em dia',
        value: '68%',
        percentage: 68,
        color: 'bg-[#65a30d]',
    },
    {
        label: 'Atrasados',
        value: '22%',
        percentage: 22,
        color: 'bg-[#f59e0b]',
    },
    {
        label: 'Inadimplentes',
        value: '10%',
        percentage: 10,
        color: 'bg-[#b91c1c]',
    },
]

const upcomingPayments = [
    {
        initials: 'MC',
        name: 'Mariana Costa',
        date: 'Hoje, 18:00',
    },
    {
        initials: 'RA',
        name: 'Rafael Alves',
        date: 'Amanhã',
    },
    {
        initials: 'JS',
        name: 'Juliana Santos',
        date: '22 de agosto',
    },
]

const quickActions = [
    {
        label: 'Novo cliente',
        icon: mdiAccountPlusOutline,
    },
    {
        label: 'Novo empréstimo',
        icon: mdiCashPlus,
    },
    {
        label: 'Registrar pagamento',
        icon: mdiCashCheck,
    },
    {
        label: 'Ver relatórios',
        icon: mdiChartLine,
    },
]
</script>