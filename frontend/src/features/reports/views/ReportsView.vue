<template>
    <div class="mx-auto w-full max-w-[1500px]">

        <section class="relative z-30 mt-5 overflow-visible rounded-xl border border-black/[0.07] bg-white p-3 sm:p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <span class="shrink-0 text-xs font-semibold text-[#27272a]">
                    Período
                </span>

                <div class="inline-flex w-fit shrink-0 rounded-lg bg-black/[0.035] p-1">
                    <button v-for="option in periodOptions" :key="option.value" type="button"
                        class="rounded-md px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-200"
                        :class="reportMode === option.value
                            ? 'bg-white text-[#202124] shadow-[0_1px_4px_rgb(0_0_0/0.08)]'
                            : 'text-black/40 hover:text-black/65'
                            " @click="changeReportMode(option.value)">
                        {{ option.label }}
                    </button>
                </div>

                <div v-if="reportMode === 'day'" class="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[270px]">
                    <span class="hidden shrink-0 text-[11px] text-black/40 sm:block">
                        Data
                    </span>

                    <div class="min-w-0 flex-1">
                        <BaseDatePicker v-model="dayDate" />
                    </div>
                </div>

                <div v-else-if="reportMode === 'week'"
                    class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-[620px]">
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="shrink-0 text-[11px] text-black/40">
                            Início
                        </span>

                        <div class="min-w-0 flex-1">
                            <BaseDatePicker v-model="weekStartDate" />
                        </div>
                    </div>

                    <span class="hidden shrink-0 text-[11px] text-black/30 sm:block">
                        até
                    </span>

                    <div class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="shrink-0 text-[11px] text-black/40">
                            Fim
                        </span>

                        <div class="min-w-0 flex-1">
                            <BaseDatePicker v-model="weekEndDate" />
                        </div>
                    </div>
                </div>

                <div v-else class="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[390px]">
                    <select v-model.number="selectedMonth"
                        class="h-11 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition-[border-color,box-shadow] hover:border-black/[0.14] focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10">
                        <option v-for="month in months" :key="month.value" :value="month.value">
                            {{ month.label }}
                        </option>
                    </select>

                    <select v-model.number="selectedYear"
                        class="h-11 w-[110px] shrink-0 rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition-[border-color,box-shadow] hover:border-black/[0.14] focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10">
                        <option v-for="year in yearOptions" :key="year" :value="year">
                            {{ year }}
                        </option>
                    </select>
                </div>
            </div>
        </section>

        <section class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article v-for="card in financialCards" :key="card.key"
                class="rounded-xl border border-black/[0.07] bg-white p-4">
                <div class="flex items-center gap-3">

                    <div class="min-w-0">
                        <p class="text-xs font-medium text-black/45">
                            {{ card.label }}
                        </p>

                        <p class="mt-0.5 truncate text-lg font-semibold tracking-[-0.02em]" :class="card.valueClass">
                            {{ card.value }}
                        </p>
                    </div>
                </div>
            </article>
        </section>

        <section class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <article class="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-6">
                <header>
                    <h2 class="text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        Desempenho financeiro
                    </h2>

                    <p class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs">
                        Comparação entre o resultado previsto e o realizado.
                    </p>
                </header>

                <div class="mt-6 space-y-6">
                    <div>
                        <div class="flex items-end justify-between gap-4">
                            <div>
                                <p class="text-xs text-black/40">
                                    Recebimentos
                                </p>

                                <p class="mt-1 text-lg font-semibold text-[#27272a]">
                                    {{ formatCurrency(totalReceived) }}
                                </p>
                            </div>

                            <div class="text-right">
                                <p class="text-[10px] text-black/35">
                                    de {{ formatCurrency(totalExpected) }}
                                </p>

                                <p class="mt-1 text-xs font-semibold text-[#166534]">
                                    {{ formatPercentage(receiptRate) }}
                                </p>
                            </div>
                        </div>

                        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-black/[0.055]">
                            <div class="h-full rounded-full bg-[#166534] transition-[width] duration-500" :style="{
                                width: `${Math.min(receiptRate, 100)}%`,
                            }" />
                        </div>
                    </div>

                    <div>
                        <div class="flex items-end justify-between gap-4">
                            <div>
                                <p class="text-xs text-black/40">
                                    Lucro
                                </p>

                                <p class="mt-1 text-lg font-semibold text-[#27272a]">
                                    {{ formatCurrency(realizedProfit) }}
                                </p>
                            </div>

                            <div class="text-right">
                                <p class="text-[10px] text-black/35">
                                    de {{ formatCurrency(expectedProfit) }}
                                </p>

                                <p class="mt-1 text-xs font-semibold text-[#166534]">
                                    {{ formatPercentage(profitRate) }}
                                </p>
                            </div>



                        </div>

                        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-black/[0.055]">
                            <div class="h-full rounded-full bg-[#4e9f3d] transition-[width] duration-500" :style="{
                                width: `${Math.min(profitRate, 100)}%`,
                            }" />
                        </div>
                    </div>

                    <div>
                        <div class="flex items-end justify-between gap-4">
                            <div>
                                <p class="text-xs text-black/40">
                                    Lucro
                                </p>

                                <p class="mt-1 text-lg font-semibold text-[#27272a]">
                                    {{ formatCurrency(realizedProfit) }}
                                </p>
                            </div>

                            <div class="text-right">
                                <p class="text-[10px] text-black/35">
                                    de {{ formatCurrency(expectedProfit) }}
                                </p>

                                <p class="mt-1 text-xs font-semibold text-[#166534]">
                                    {{ formatPercentage(profitRate) }}
                                </p>
                            </div>



                        </div>

                        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-black/[0.055]">
                            <div class="h-full rounded-full bg-[#4e9f3d] transition-[width] duration-500" :style="{
                                width: `${Math.min(profitRate, 100)}%`,
                            }" />
                        </div>
                    </div>
                </div>

            </article>

            <article class="flex min-h-0 flex-col rounded-xl border border-black/[0.07] bg-white p-4 sm:p-6">


                <template v-if="pendingRecords.length">
                    <div class=" grid shrink-0 grid-cols-2 gap-2">
                        <div class="rounded-lg bg-[#fafafa] p-3">
                            <p class="text-[10px] text-black/35">
                                Pagamentos atrasados
                            </p>

                            <p class="mt-1 text-sm font-semibold text-[#27272a]">
                                {{ pendingContracts }}
                                {{ pendingContracts === 1 ? 'contrato' : 'contratos' }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-[#fafafa] p-3">
                            <p class="text-[10px] text-black/35">
                                Valor pendente
                            </p>

                            <p class="mt-1 text-sm font-semibold text-[#b91c1c]">
                                {{ formatCurrency(totalPending) }}
                            </p>
                        </div>
                    </div>

                    <div class="mt-4 max-h-[260px] min-h-0 overflow-y-auto overscroll-contain pr-1">
                        <div class="divide-y divide-black/[0.055]">
                            <div v-for="payment in pendingRecords" :key="payment.id"
                                class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                <div class="min-w-0">
                                    <p class="truncate text-xs font-medium text-[#27272a]">
                                        {{ payment.client }}
                                    </p>

                                    <p class="mt-0.5 text-[10px] text-black/35">
                                        Contrato #{{ payment.contractId }}

                                        <template v-if="payment.daysLate">
                                            • {{ payment.daysLate }}
                                            {{
                                                payment.daysLate === 1
                                                    ? 'dia de atraso'
                                                    : 'dias de atraso'
                                            }}
                                        </template>
                                    </p>
                                </div>

                                <div class="shrink-0 text-right">
                                    <p class="text-xs font-semibold text-[#27272a]">
                                        {{
                                            formatCurrency(
                                                getOutstandingValue(payment),
                                            )
                                        }}
                                    </p>


                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <div v-else class="flex min-h-[250px] flex-1 flex-col items-center justify-center text-center">
                    <span class="mdi mdi-check-circle-outline text-3xl text-[#166534]" aria-hidden="true" />

                    <p class="mt-3 text-sm font-medium text-[#27272a]">
                        Nenhuma pendência
                    </p>

                    <p class="mt-1 text-xs text-black/35">
                        Todos os pagamentos previstos foram realizados.
                    </p>
                </div>
            </article>
        </section>

        <section class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <article v-for="indicator in paymentIndicators" :key="indicator.key"
                class="rounded-xl border border-black/[0.07] bg-white p-4">
                <div class="flex items-center gap-3">


                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium text-black/40">
                            {{ indicator.label }}
                        </p>

                        <div class="mt-0.5 flex items-baseline gap-2">
                            <p class="text-lg font-semibold tracking-[-0.02em] text-[#27272a]">
                                {{ indicator.value }}
                            </p>

                            <span v-if="indicator.percentage !== null" class="text-[10px] font-semibold"
                                :class="indicator.percentageClass">
                                {{ formatPercentage(indicator.percentage) }}
                            </span>
                        </div>
                    </div>
                </div>
            </article>
        </section>

        <section class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
            <BaseBarChart title="Recebimentos no período" :description="chartDescription" :items="chartItems"
                :height="285" :value-formatter="formatCurrency" />

            <article class="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-6">
                <header>
                    <h2 class="text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        Situação dos pagamentos
                    </h2>

                    <p class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs">
                        Clique em uma situação para filtrar a tabela.
                    </p>
                </header>

                <div v-if="recordCount" class="mt-6">
                    <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                        <div class="relative size-[205px] shrink-0" @pointerleave="hoveredPaymentStatus = ''">
                            <svg viewBox="0 0 160 160" class="size-full -rotate-90 overflow-visible">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="#f2f2f2" stroke-width="20" />

                                <circle v-for="item in paymentStatusItems" :key="item.key" cx="80" cy="80" r="58"
                                    fill="none" pathLength="100" :stroke="item.color" :stroke-width="isPaymentStatusHighlighted(item.key)
                                        ? 24
                                        : 20
                                        " :stroke-dasharray="`${item.percentage} ${100 - item.percentage}`
                                            " :stroke-dashoffset="-item.offset"
                                    class="cursor-pointer transition-[stroke-width,opacity] duration-200" :class="hasHighlightedPaymentStatus &&
                                        !isPaymentStatusHighlighted(item.key)
                                        ? 'opacity-30'
                                        : 'opacity-100'
                                        " @pointerenter="hoveredPaymentStatus = item.key"
                                    @click="togglePaymentStatus(item.key)" />
                            </svg>

                            <div
                                class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                <template v-if="highlightedPaymentStatusItem">
                                    <strong class="text-3xl font-semibold tracking-[-0.04em] text-[#27272a]">
                                        {{ highlightedPaymentStatusItem.value }}
                                    </strong>

                                    <span class="mt-1 text-xs font-semibold" :style="{
                                        color: highlightedPaymentStatusItem.color,
                                    }">
                                        {{ highlightedPaymentStatusItem.label }}
                                    </span>

                                    <span class="mt-1 text-[10px] text-black/35">
                                        {{
                                            formatPercentage(
                                                highlightedPaymentStatusItem.percentage,
                                            )
                                        }}
                                    </span>
                                </template>

                                <template v-else>
                                    <strong class="text-3xl font-semibold tracking-[-0.04em] text-[#27272a]">
                                        {{ recordCount }}
                                    </strong>

                                    <span class="mt-1 text-xs text-black/40">
                                        previstos
                                    </span>
                                </template>
                            </div>
                        </div>

                        <div class="w-full min-w-0 space-y-2">
                            <button v-for="item in paymentStatusItems" :key="item.key" type="button"
                                class="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px"
                                :class="selectedPaymentStatus === item.key
                                    ? 'border-black/[0.10] bg-black/[0.025]'
                                    : 'border-transparent bg-[#fafafa] hover:border-black/[0.07]'
                                    " @pointerenter="hoveredPaymentStatus = item.key"
                                @pointerleave="hoveredPaymentStatus = ''" @click="togglePaymentStatus(item.key)">
                                <span class="h-9 w-1 shrink-0 rounded-full" :style="{
                                    backgroundColor: item.color,
                                }" />

                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-semibold text-[#27272a]">
                                        {{ item.label }}
                                    </p>

                                    <p class="mt-0.5 text-[10px] text-black/35">
                                        {{ formatPercentage(item.percentage) }}
                                        do total
                                    </p>
                                </div>

                                <strong class="shrink-0 text-xl font-semibold tracking-[-0.03em] text-[#27272a]">
                                    {{ item.value }}
                                </strong>
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="flex h-[280px] items-center justify-center text-xs text-[#8b8b93]">
                    Nenhum pagamento previsto no período.
                </div>
            </article>
        </section>

        <section class="mt-5 overflow-hidden rounded-xl border border-black/[0.07] bg-white">
            <header
                class="flex flex-col gap-3 border-b border-black/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
                <div class="min-w-0">
                    <h2 class="text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                        Pagamentos do período
                    </h2>

                    <p class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs">
                        Consulte e ordene os recebimentos previstos.
                    </p>
                </div>

                <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
                    <div class="relative min-w-0 flex-1 lg:w-[260px] lg:flex-none">
                        <input v-model="search" type="search" placeholder="Pesquisar cliente ou contrato"
                            class="h-9 w-full rounded-lg border border-black/[0.08] bg-white pr-9 pl-3 text-xs text-[#27272a] outline-none transition-[border-color,box-shadow] placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10" />

                        <span
                            class="mdi mdi-magnify pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-base text-black/30"
                            aria-hidden="true" />
                    </div>

                    <div class="flex gap-2 md:hidden">
                        <select v-model="sortKey"
                            class="h-9 min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-white px-3 text-xs text-[#27272a] outline-none">
                            <option v-for="option in mobileSortOptions" :key="option.key" :value="option.key">
                                Ordenar: {{ option.label }}
                            </option>
                        </select>

                        <button type="button"
                            class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] text-black/45"
                            :aria-label="sortDirection === 'asc'
                                ? 'Ordenação crescente'
                                : 'Ordenação decrescente'
                                " @click="toggleSortDirection">
                            <span class="mdi" :class="sortDirection === 'asc'
                                ? 'mdi-sort-ascending'
                                : 'mdi-sort-descending'
                                " aria-hidden="true" />
                        </button>
                    </div>

                    <button v-if="selectedPaymentStatus !== 'all'" type="button"
                        class="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-black/[0.035] px-3 text-[10px] font-medium text-black/50 transition-colors hover:bg-black/[0.06] hover:text-black/70"
                        @click="selectedPaymentStatus = 'all'">
                        <span class="mdi mdi-close text-sm" aria-hidden="true" />

                        {{ selectedPaymentStatusLabel }}
                    </button>
                </div>
            </header>

            <div v-if="sortedPeriodRecords.length" class="hidden overflow-x-auto md:block">
                <table class="w-full min-w-[940px] border-collapse">
                    <thead>
                        <tr class="border-b border-black/[0.055] bg-[#fafafa]">
                            <th v-for="column in tableColumns" :key="column.key" class="px-4 py-3" :class="[
                                column.align === 'right'
                                    ? 'text-right'
                                    : column.align === 'center'
                                        ? 'text-center'
                                        : 'text-left',
                                column.key === 'client'
                                    ? 'pl-5'
                                    : '',
                                column.key === 'status'
                                    ? 'pr-5'
                                    : '',
                            ]">
                                <button type="button"
                                    class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-black/35 transition-colors hover:text-black/60"
                                    :class="column.align === 'right'
                                        ? 'justify-end'
                                        : column.align === 'center'
                                            ? 'justify-center'
                                            : 'justify-start'
                                        " @click="setSort(column.key)">
                                    {{ column.label }}

                                    <span class="mdi text-xs" :class="sortKey === column.key
                                        ? sortDirection === 'asc'
                                            ? 'mdi-chevron-up text-black/55'
                                            : 'mdi-chevron-down text-black/55'
                                        : 'mdi-unfold-more-horizontal text-black/20'
                                        " aria-hidden="true" />
                                </button>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="payment in sortedPeriodRecords" :key="payment.id"
                            class="border-b border-black/[0.045] transition-colors last:border-b-0 hover:bg-black/[0.012]">
                            <td class="px-5 py-4">
                                <p class="text-sm font-medium text-[#27272a]">
                                    {{ payment.client }}
                                </p>
                            </td>

                            <td class="px-4 py-4 text-xs font-medium text-black/50">
                                #{{ payment.contractId }}
                            </td>

                            <td class="px-4 py-4 text-xs text-black/50">
                                {{ formatShortDate(payment.date) }}
                            </td>

                            <td class="px-4 py-4 text-right text-xs font-medium text-[#27272a]">
                                {{ formatCurrency(payment.expected) }}
                            </td>

                            <td class="px-4 py-4 text-right text-xs font-medium" :class="payment.received > 0
                                ? 'text-[#166534]'
                                : 'text-black/30'
                                ">
                                {{ formatCurrency(payment.received) }}
                            </td>

                            <td class="px-4 py-4 text-right text-xs font-medium" :class="getOutstandingValue(payment) > 0
                                ? 'text-[#b91c1c]'
                                : 'text-black/30'
                                ">
                                {{
                                    formatCurrency(
                                        getOutstandingValue(payment),
                                    )
                                }}
                            </td>

                            <td class="px-4 py-4 text-xs text-black/45">
                                {{
                                    payment.paymentDate
                                        ? formatShortDate(payment.paymentDate)
                                        : '—'
                                }}
                            </td>

                            <td class="px-5 py-4 text-center">
                                <span
                                    class="inline-flex min-w-[78px] items-center justify-center rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-white"
                                    :class="getStatusClass(payment.status)">
                                    {{ getStatusLabel(payment.status) }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="sortedPeriodRecords.length" class="divide-y divide-black/[0.055] md:hidden">
                <article v-for="payment in sortedPeriodRecords" :key="payment.id" class="p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="truncate text-sm font-semibold text-[#27272a]">
                                {{ payment.client }}
                            </p>

                            <p class="mt-1 text-[10px] text-black/35">
                                Contrato #{{ payment.contractId }}
                                •
                                {{ formatShortDate(payment.date) }}
                            </p>
                        </div>

                        <span class="shrink-0 rounded-md px-2 py-1 text-[9px] font-semibold text-white"
                            :class="getStatusClass(payment.status)">
                            {{ getStatusLabel(payment.status) }}
                        </span>
                    </div>

                    <div class="mt-4 grid grid-cols-3 gap-2">
                        <div>
                            <p class="text-[9px] uppercase text-black/30">
                                Previsto
                            </p>

                            <p class="mt-1 text-xs font-semibold text-[#27272a]">
                                {{ formatCurrency(payment.expected) }}
                            </p>
                        </div>

                        <div>
                            <p class="text-[9px] uppercase text-black/30">
                                Recebido
                            </p>

                            <p class="mt-1 text-xs font-semibold text-[#166534]">
                                {{ formatCurrency(payment.received) }}
                            </p>
                        </div>

                        <div>
                            <p class="text-[9px] uppercase text-black/30">
                                Pendente
                            </p>

                            <p class="mt-1 text-xs font-semibold" :class="getOutstandingValue(payment) > 0
                                ? 'text-[#b91c1c]'
                                : 'text-black/35'
                                ">
                                {{
                                    formatCurrency(
                                        getOutstandingValue(payment),
                                    )
                                }}
                            </p>
                        </div>
                    </div>

                    <div
                        class="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3 text-[10px] text-black/35">
                        <span>
                            Pagamento
                        </span>

                        <span>
                            {{
                                payment.paymentDate
                                    ? formatShortDate(payment.paymentDate)
                                    : 'Não realizado'
                            }}
                        </span>
                    </div>
                </article>
            </div>

            <div v-if="!sortedPeriodRecords.length"
                class="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
                <span class="mdi mdi-file-chart-outline text-3xl text-black/20" aria-hidden="true" />

                <p class="mt-3 text-sm font-medium text-[#27272a]">
                    Nenhum pagamento encontrado
                </p>

                <p class="mt-1 text-xs text-black/35">
                    Não existem registros para a pesquisa ou período selecionado.
                </p>
            </div>
        </section>
        <div ref="target" aria-hidden="true" />
    </div>
</template>

<script setup>
import {
    computed,
    ref,
    watch,
} from 'vue'

import BaseBarChart from '@/components/base/BaseBarChart.vue'
import BaseDatePicker from '@/components/base/BaseDatePicker.vue'
import { getReport, currentDate } from '@/services/paytrack'
import { usePagedList } from '@/composables/usePagedList'

const periodOptions = [
    {
        label: 'Dia',
        value: 'day',
    },
    {
        label: 'Semana',
        value: 'week',
    },
    {
        label: 'Mês',
        value: 'month',
    },
]

const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
]

const tableColumns = [
    {
        key: 'client',
        label: 'Cliente',
        align: 'left',
    },
    {
        key: 'contractId',
        label: 'Contrato',
        align: 'left',
    },
    {
        key: 'date',
        label: 'Vencimento',
        align: 'left',
    },
    {
        key: 'expected',
        label: 'Previsto',
        align: 'right',
    },
    {
        key: 'received',
        label: 'Recebido',
        align: 'right',
    },
    {
        key: 'pending',
        label: 'Pendente',
        align: 'right',
    },
    {
        key: 'paymentDate',
        label: 'Pagamento',
        align: 'left',
    },
    {
        key: 'status',
        label: 'Status',
        align: 'center',
    },
]

const mobileSortOptions = tableColumns

const reportMode = ref('day')

const dayDate = ref(currentDate())

const weekStartDate = ref(currentDate())
const weekEndDate = ref(formatIsoDate(new Date(Date.parse(currentDate()) + 6 * 86400000)))

const selectedMonth = ref(Number(currentDate().slice(5,7)))
const selectedYear = ref(Number(currentDate().slice(0,4)))

const selectedPaymentStatus = ref('all')
const hoveredPaymentStatus = ref('')

const search = ref('')
const sortKey = ref('date')
const sortDirection = ref('asc')

const currentYear = new Date().getFullYear()

const yearOptions = computed(() => {
    const years = new Set()

    for (
        let year = currentYear - 5;
        year <= currentYear + 2;
        year += 1
    ) {
        years.add(year)
    }

    years.add(selectedYear.value)

    return [...years].sort(
        (first, second) => first - second,
    )
})

watch(
    weekStartDate,
    (value) => {
        const start = parseDate(value)

        if (!start) {
            return
        }

        start.setUTCDate(
            start.getUTCDate() + 6,
        )

        weekEndDate.value =
            formatIsoDate(start)
    },
)

watch(
    [
        reportMode,
        dayDate,
        weekStartDate,
        weekEndDate,
        selectedMonth,
        selectedYear,
    ],
    () => {
        selectedPaymentStatus.value = 'all'
        hoveredPaymentStatus.value = ''
    },
)

const periodRange = computed(() => {
    if (reportMode.value === 'day') {
        return {
            start: dayDate.value,
            end: dayDate.value,
        }
    }

    if (reportMode.value === 'week') {
        return {
            start: weekStartDate.value,
            end: weekEndDate.value,
        }
    }

    const start = formatDateParts(
        selectedYear.value,
        selectedMonth.value,
        1,
    )

    const lastDay = new Date(
        Date.UTC(
            selectedYear.value,
            selectedMonth.value,
            0,
        ),
    ).getUTCDate()

    const end = formatDateParts(
        selectedYear.value,
        selectedMonth.value,
        lastDay,
    )

    return {
        start,
        end,
    }
})

const query = computed(() => ({ ...periodRange.value, mode:reportMode.value, status:selectedPaymentStatus.value, search:search.value, sort:sortKey.value, direction:sortDirection.value }))
const { items:sortedPeriodRecords, metadata, target } = usePagedList(getReport, query)
const summary = computed(() => metadata.value?.summary ?? {})
const recordCount = computed(() => summary.value.count ?? 0)
const paidCount = computed(() => summary.value.paid ?? 0)
const partialCount = computed(() => summary.value.partial ?? 0)
const unpaidCount = computed(() => summary.value.unpaid ?? 0)
const totalExpected = computed(() => Number(summary.value.expected ?? 0))
const totalReceived = computed(() => Number(summary.value.received ?? 0))
const totalPending = computed(() => Number(summary.value.pending ?? 0))
const expectedProfit = computed(() => Number(summary.value.expectedProfit ?? 0))
const realizedProfit = computed(() => Number(summary.value.realizedProfit ?? 0))
const pendingRecords = computed(() => metadata.value?.pending ?? [])
const pendingContracts = computed(() => summary.value.pendingContracts ?? 0)

const receiptRate = computed(() => {
    if (!totalExpected.value) {
        return 0
    }

    return (
        totalReceived.value /
        totalExpected.value
    ) * 100
})

const profitRate = computed(() => {
    if (!expectedProfit.value) {
        return 0
    }

    return (
        realizedProfit.value /
        expectedProfit.value
    ) * 100
})

const financialCards = computed(() => [
    {
        key: 'expected',
        label: 'Previsto para receber',
        value: formatCurrency(
            totalExpected.value,
        ),
        valueClass: 'text-[#27272a]',
    },
    {
        key: 'received',
        label: 'Total recebido',
        value: formatCurrency(
            totalReceived.value,
        ),
        valueClass: 'text-[#166534]',
    },
    {
        key: 'pending',
        label: 'Falta receber',
        value: formatCurrency(
            totalPending.value,
        ),
        valueClass:
            totalPending.value > 0
                ? 'text-[#b91c1c]'
                : 'text-[#166534]',
    },
    {
        key: 'expected-profit',
        label: 'Lucro previsto',
        value: formatCurrency(
            expectedProfit.value,
        ),
        valueClass: 'text-[#27272a]',
    },
    {
        key: 'realized-profit',
        label: 'Lucro realizado',
        value: formatCurrency(
            realizedProfit.value,
        ),
        valueClass: 'text-[#166534]',
    },
])

const paymentIndicators = computed(() => [
    {
        key: 'expected',
        label: 'Pagamentos previstos',
        value: recordCount.value,
        percentage: null,
        percentageClass: '',
    },
    {
        key: 'paid',
        label: 'Pagamentos realizados',
        value: paidCount.value,
        percentage: getPercentage(
            paidCount.value,
            recordCount.value,
        ),
        percentageClass: 'text-[#166534]',
    },
    {
        key: 'partial',
        label: 'Pagamentos parciais',
        value: partialCount.value,
        percentage: getPercentage(
            partialCount.value,
            recordCount.value,
        ),
        percentageClass: 'text-[#b45309]',
    },
    {
        key: 'unpaid',
        label: 'Não pagos',
        value: unpaidCount.value,
        percentage: getPercentage(
            unpaidCount.value,
            recordCount.value,
        ),
        percentageClass: 'text-[#b91c1c]',
    },
])

const paymentStatusItems = computed(() => {
    const total =
        recordCount.value

    const items = [
        {
            key: 'paid',
            label: 'Pagos',
            value: paidCount.value,
            color: '#166534',
        },
        {
            key: 'partial',
            label: 'Parciais',
            value:
                partialCount.value,
            color: '#d99732',
        },
        {
            key: 'unpaid',
            label: 'Não pagos',
            value:
                unpaidCount.value,
            color: '#c24141',
        },
    ]

    let offset = 0

    return items.map((item) => {
        const percentage =
            total > 0
                ? (item.value / total) *
                100
                : 0

        const result = {
            ...item,
            percentage,
            offset,
        }

        offset += percentage

        return result
    })
})

const highlightedPaymentStatusKey =
    computed(() => {
        if (
            hoveredPaymentStatus.value
        ) {
            return hoveredPaymentStatus.value
        }

        if (
            selectedPaymentStatus.value !==
            'all'
        ) {
            return selectedPaymentStatus.value
        }

        return ''
    })

const highlightedPaymentStatusItem =
    computed(
        () =>
            paymentStatusItems.value.find(
                (item) =>
                    item.key ===
                    highlightedPaymentStatusKey.value,
            ) ?? null,
    )

const hasHighlightedPaymentStatus =
    computed(() =>
        Boolean(
            highlightedPaymentStatusKey.value,
        ),
    )

const selectedPaymentStatusLabel =
    computed(() =>
        getStatusLabel(
            selectedPaymentStatus.value,
        ),
    )

const chartItems = computed(() => (metadata.value?.chart ?? []).map(item => ({
    id:item.start,
    label:reportMode.value === 'month' ? item.start.slice(8) + '–' + item.end.slice(8) : reportMode.value === 'day' ? formatDayMonth(item.start) : formatWeekday(item.start),
    fullLabel:formatLongDate(item.start) + (item.end !== item.start ? ' – ' + formatLongDate(item.end) : ''),
    value:Number(item.value),
})))

const chartDescription = computed(() => {
    if (reportMode.value === 'day') {
        return 'Total recebido na data selecionada.'
    }

    if (reportMode.value === 'week') {
        return 'Recebimentos por dia dentro do período selecionado.'
    }

    return 'Recebimentos agrupados por semana dentro do mês selecionado.'
})

function setSort(key) {
    if (
        sortKey.value === key
    ) {
        toggleSortDirection()
        return
    }

    sortKey.value = key
    sortDirection.value = 'asc'
}

function toggleSortDirection() {
    sortDirection.value =
        sortDirection.value === 'asc'
            ? 'desc'
            : 'asc'
}

function changeReportMode(mode) {
    reportMode.value = mode
}

function getPercentage(
    value,
    total,
) {
    if (!total) {
        return 0
    }

    return (
        Number(value) /
        Number(total)
    ) * 100
}

function getOutstandingValue(payment) {
    return Number(payment.pending)
}

function getStatusLabel(
    status,
) {
    return {
        all: 'Todos',
        paid: 'Pago',
        partial: 'Parcial',
        unpaid: 'Não pago',
    }[status] ?? status
}

function getStatusClass(
    status,
) {
    return {
        paid: 'bg-[#166534]',
        partial: 'bg-[#d99732]',
        unpaid: 'bg-[#c24141]',
    }[status] ?? 'bg-[#52525b]'
}

function isPaymentStatusHighlighted(
    status,
) {
    return (
        highlightedPaymentStatusKey.value ===
        status
    )
}

function togglePaymentStatus(
    status,
) {
    selectedPaymentStatus.value =
        selectedPaymentStatus.value ===
            status
            ? 'all'
            : status
}

function parseDate(value) {
    if (!value) {
        return null
    }

    const parts =
        String(value)
            .split('-')
            .map(Number)

    if (
        parts.length !== 3 ||
        parts.some(
            (part) =>
                !Number.isFinite(part),
        )
    ) {
        return null
    }

    const [
        year,
        month,
        day,
    ] = parts

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    )
}

function formatIsoDate(date) {
    return formatDateParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
    )
}

function formatDateParts(
    year,
    month,
    day,
) {
    return [
        year,
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0'),
    ].join('-')
}

function formatCurrency(value) {
    return new Intl.NumberFormat(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL',
        },
    ).format(
        Number(value) || 0,
    )
}

function formatPercentage(value) {
    return (
        new Intl.NumberFormat(
            'pt-BR',
            {
                maximumFractionDigits: 1,
            },
        ).format(
            Number(value) || 0,
        ) + '%'
    )
}

function formatShortDate(value) {
    const date =
        parseDate(value)

    if (!date) {
        return '—'
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'UTC',
        },
    ).format(date)
}

function formatLongDate(value) {
    const date =
        parseDate(value)

    if (!date) {
        return '—'
    }

    const result =
        new Intl.DateTimeFormat(
            'pt-BR',
            {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
            },
        ).format(date)

    return (
        result.charAt(0).toUpperCase() +
        result.slice(1)
    )
}

function formatWeekday(value) {
    const date =
        parseDate(value)

    if (!date) {
        return '—'
    }

    const result =
        new Intl.DateTimeFormat(
            'pt-BR',
            {
                weekday: 'short',
                timeZone: 'UTC',
            },
        )
            .format(date)
            .replace('.', '')

    return (
        result.charAt(0).toUpperCase() +
        result.slice(1)
    )
}

function formatDayMonth(value) {
    const date =
        parseDate(value)

    if (!date) {
        return '—'
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            day: '2-digit',
            month: '2-digit',
            timeZone: 'UTC',
        },
    ).format(date)
}
</script>