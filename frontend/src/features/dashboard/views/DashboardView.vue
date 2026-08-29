<template>
    <div class="mx-auto w-full max-w-[1500px]">
        <section class="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard v-for="card in summaryCards" :key="card.title" v-bind="card" />
        </section>

        <BaseBarChart class="mt-4 sm:mt-5" title="Recebimentos" description="Valores recebidos nos últimos sete dias"
            badge="Esta semana" series-name="Recebimentos" :items="receiptChart" :value-formatter="formatCurrency" />

        <section class="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
            <PortfolioSummaryCard title="Resumo da carteira" :items="portfolioSummary" />

            <UpcomingPaymentsCard title="Próximos pagamentos" :items="upcomingPayments" @select="handlePaymentSelect" />
        </section>
    </div>
</template>

<script setup>
import BaseBarChart from '@/components/base/BaseBarChart.vue'
import PortfolioSummaryCard from '../components/PortfolioSummaryCard.vue'
import SummaryCard from '../components/SummaryCard.vue'
import UpcomingPaymentsCard from '../components/UpcomingPaymentsCard.vue'

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
        value: 1850,
    },
    {
        label: 'Ter',
        value: 3200,
    },
    {
        label: 'Qua',
        value: 1420,
    },
    {
        label: 'Qui',
        value: 3650,
        highlight: true,
    },
    {
        label: 'Sex',
        value: 2100,
    },
    {
        label: 'Sáb',
        value: 4200,
        highlight: true,
    },
    {
        label: 'Dom',
        value: 1280,
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
        id: 1,
        initials: 'MC',
        name: 'Mariana Costa',
        date: 'Hoje, 18:00',
    },
    {
        id: 2,
        initials: 'RA',
        name: 'Rafael Alves',
        date: 'Amanhã',
    },
    {
        id: 3,
        initials: 'JS',
        name: 'Juliana Santos',
        date: '22 de agosto',
    },
]

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

const handlePaymentSelect = (payment) => {
    console.log(payment)
}
</script>
