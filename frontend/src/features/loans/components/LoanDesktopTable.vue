<template>
    <div class="hidden overflow-hidden rounded-xl border border-black/[0.07] bg-white lg:block">
        <table class="w-full table-fixed">
            <thead class="border-b border-black/[0.06] bg-black/[0.015]">
                <tr class="text-left text-xs font-medium text-black/45">
                    <th class="w-[22%] px-4 py-3.5">
                        Cliente
                    </th>

                    <th class="px-4 py-3.5">
                        Emprestado
                    </th>

                    <th class="px-4 py-3.5">
                        Parcelas
                    </th>

                    <th class="px-4 py-3.5">
                        Valor parcela
                    </th>

                    <th class="px-4 py-3.5">
                        Juros
                    </th>

                    <th class="px-4 py-3.5">
                        Pagas
                    </th>

                    <th class="px-4 py-3.5">
                        Status
                    </th>
                </tr>
            </thead>

            <tbody class="divide-y divide-black/[0.05]">
                <tr v-for="loan in loans" :key="loan.id" class="transition hover:bg-black/[0.015]">
                    <td class="px-4 py-4">
                        <p class="truncate text-sm font-medium text-[#202124]">
                            {{ loan.clientName }}
                        </p>
                    </td>

                    <td class="px-4 py-4 text-sm font-medium text-[#202124]">
                        {{ formatCurrency(loan.amount) }}
                    </td>

                    <td class="px-4 py-4 text-sm text-black/60">
                        {{ loan.installmentCount }}x
                    </td>

                    <td class="px-4 py-4 text-sm text-black/60">
                        {{ formatCurrency(loan.installmentValue) }}
                    </td>

                    <td class="px-4 py-4 text-sm text-black/60">
                        {{ loan.interest }}%
                    </td>

                    <td class="px-4 py-4">
                        <span class="text-sm font-medium text-[#202124]">
                            {{ loan.paidInstallments }}
                        </span>

                        <span class="text-sm text-black/35">
                            /{{ loan.installmentCount }}
                        </span>
                    </td>

                    <td class="px-4 py-4">
                        <LoanStatusBadge :status="loan.status" />
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
import LoanStatusBadge from './LoanStatusBadge.vue'

defineProps({
    loans: {
        type: Array,
        default: () => []
    }
})

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
</script>