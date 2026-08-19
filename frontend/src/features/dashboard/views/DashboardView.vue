<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <section class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 class="text-[26px] font-semibold tracking-[-0.035em] text-[#18181b] sm:text-[30px]">
                    Dashboard
                </h1>

                <p class="mt-1 text-[13px] text-[#71717a]">
                    Acompanhe os principais indicadores da sua operação.
                </p>
            </div>

        </section>

        <section class="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Total emprestado" value="R$ 28.500,00" description="Valor atualmente em circulação"
                indicator="+8,4%" status="positive" />

            <SummaryCard title="Total recebido" value="R$ 17.920,00" description="Pagamentos recebidos no período"
                indicator="+12,1%" status="positive" />

            <SummaryCard title="Empréstimos ativos" value="18" description="Contratos atualmente em andamento" />

            <SummaryCard title="Inadimplentes" value="4" description="Clientes com pagamentos em atraso"
                indicator="Atenção" status="danger" />
        </section>

        <section class="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <article class="min-h-[340px] rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-[14px] font-semibold text-[#27272a]">
                            Recebimentos
                        </h2>

                        <p class="mt-1 text-[11px] text-[#a1a1aa]">
                            Desempenho dos últimos meses
                        </p>
                    </div>

                    <button type="button"
                        class="rounded-lg border border-black/[0.08] px-3 py-2 text-[11px] font-medium text-[#71717a]">
                        Últimos 6 meses
                    </button>
                </div>

                <div class="mt-8 flex h-[230px] items-end gap-3 sm:gap-5">
                    <div v-for="item in monthlyReceipts" :key="item.month"
                        class="flex h-full flex-1 flex-col justify-end">
                        <div class="flex flex-1 items-end">
                            <div class="w-full rounded-t-lg bg-[#dcfce7] transition-all hover:bg-[#bbf7d0]"
                                :style="{ height: `${item.height}%` }" />
                        </div>

                        <span class="mt-3 text-center text-[10px] font-medium text-[#a1a1aa]">
                            {{ item.month }}
                        </span>
                    </div>
                </div>
            </article>

            <article class="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
                <div>
                    <h2 class="text-[14px] font-semibold text-[#27272a]">
                        Carteira de clientes
                    </h2>

                    <p class="mt-1 text-[11px] text-[#a1a1aa]">
                        Distribuição por situação
                    </p>
                </div>

                <div class="mt-8 space-y-6">
                    <div v-for="clientStatus in clientStatuses" :key="clientStatus.label">
                        <div class="mb-2 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span :class="[
                                    'h-2 w-2 rounded-full',
                                    clientStatus.dotClass,
                                ]" />

                                <span class="text-[12px] font-medium text-[#52525b]">
                                    {{ clientStatus.label }}
                                </span>
                            </div>

                            <span class="text-[12px] font-semibold text-[#27272a]">
                                {{ clientStatus.value }}
                            </span>
                        </div>

                        <div class="h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]">
                            <div :class="[
                                'h-full rounded-full',
                                clientStatus.barClass,
                            ]" :style="{ width: `${clientStatus.percentage}%` }" />
                        </div>
                    </div>
                </div>

                <div class="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-5">
                    <span class="text-[11px] text-[#a1a1aa]">
                        Total de clientes
                    </span>

                    <span class="text-[15px] font-semibold text-[#27272a]">
                        37
                    </span>
                </div>
            </article>
        </section>

        <section class="mt-5 rounded-2xl border border-black/[0.07] bg-white">
            <div class="flex items-center justify-between border-b border-black/[0.06] px-5 py-5 sm:px-6">
                <div>
                    <h2 class="text-[14px] font-semibold text-[#27272a]">
                        Pagamentos recentes
                    </h2>

                    <p class="mt-1 text-[11px] text-[#a1a1aa]">
                        Últimas movimentações registradas
                    </p>
                </div>

                <button type="button" class="text-[11px] font-semibold text-[#166534] hover:text-[#14532d]">
                    Ver todos
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full min-w-[680px] border-collapse">
                    <thead>
                        <tr class="border-b border-black/[0.05]">
                            <th
                                class="px-6 py-3 text-left text-[10px] font-semibold tracking-[0.06em] text-[#a1a1aa] uppercase">
                                Cliente
                            </th>

                            <th
                                class="px-6 py-3 text-left text-[10px] font-semibold tracking-[0.06em] text-[#a1a1aa] uppercase">
                                Data
                            </th>

                            <th
                                class="px-6 py-3 text-left text-[10px] font-semibold tracking-[0.06em] text-[#a1a1aa] uppercase">
                                Parcela
                            </th>

                            <th
                                class="px-6 py-3 text-left text-[10px] font-semibold tracking-[0.06em] text-[#a1a1aa] uppercase">
                                Valor
                            </th>

                            <th
                                class="px-6 py-3 text-left text-[10px] font-semibold tracking-[0.06em] text-[#a1a1aa] uppercase">
                                Status
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="payment in recentPayments" :key="payment.id"
                            class="border-b border-black/[0.04] last:border-b-0 hover:bg-[#fafafa]">
                            <td class="px-6 py-4">
                                <p class="text-[12px] font-semibold text-[#3f3f46]">
                                    {{ payment.client }}
                                </p>
                            </td>

                            <td class="px-6 py-4 text-[11px] text-[#71717a]">
                                {{ payment.date }}
                            </td>

                            <td class="px-6 py-4 text-[11px] text-[#71717a]">
                                {{ payment.installment }}
                            </td>

                            <td class="px-6 py-4 text-[12px] font-semibold text-[#3f3f46]">
                                {{ payment.value }}
                            </td>

                            <td class="px-6 py-4">
                                <span
                                    class="rounded-md bg-[#f0fdf4] px-2 py-1 text-[10px] font-semibold text-[#15803d]">
                                    Pago
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>

<script setup>
import SummaryCard from '@/features/dashboard/components/SummaryCard.vue'

const monthlyReceipts = [
    { month: 'Mar', height: 42 },
    { month: 'Abr', height: 58 },
    { month: 'Mai', height: 51 },
    { month: 'Jun', height: 72 },
    { month: 'Jul', height: 65 },
    { month: 'Ago', height: 87 },
]

const clientStatuses = [
    {
        label: 'Ativos',
        value: 25,
        percentage: 68,
        dotClass: 'bg-[#16a34a]',
        barClass: 'bg-[#22c55e]',
    },
    {
        label: 'Quitados',
        value: 8,
        percentage: 22,
        dotClass: 'bg-[#a1a1aa]',
        barClass: 'bg-[#d4d4d8]',
    },
    {
        label: 'Inadimplentes',
        value: 4,
        percentage: 10,
        dotClass: 'bg-[#dc2626]',
        barClass: 'bg-[#ef4444]',
    },
]

const recentPayments = [
    {
        id: 1,
        client: 'Carlos Almeida',
        date: '18/08/2026',
        installment: '12 de 30',
        value: 'R$ 100,00',
    },
    {
        id: 2,
        client: 'Mariana Santos',
        date: '18/08/2026',
        installment: '8 de 20',
        value: 'R$ 150,00',
    },
    {
        id: 3,
        client: 'Roberto Oliveira',
        date: '17/08/2026',
        installment: '21 de 35',
        value: 'R$ 80,00',
    },
    {
        id: 4,
        client: 'Fernanda Costa',
        date: '17/08/2026',
        installment: '5 de 15',
        value: 'R$ 200,00',
    },
]
</script>