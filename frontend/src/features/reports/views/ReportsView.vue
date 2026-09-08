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
                                {{ largestDelay }}
                                {{ largestDelay === 1 ? 'contrato' : 'contratos' }}
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

                                        <template class="" v-if="payment.daysLate">
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

                <div v-if="periodRecords.length" class="mt-6">
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
                                        {{ periodRecords.length }}
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

const dayDate = ref('2026-08-25')

const weekStartDate = ref('2026-08-25')
const weekEndDate = ref('2026-08-31')

const selectedMonth = ref(8)
const selectedYear = ref(2026)

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

const payments = ref([
    {
        id: 1,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'João da Silva',
        contractId: 48,
        expected: 466.67,
        received: 466.67,
        expectedProfit: 75,
        realizedProfit: 75,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 2,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'Larissa Gomes',
        contractId: 71,
        expected: 560,
        received: 560,
        expectedProfit: 84,
        realizedProfit: 84,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 3,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'Vinícius Ribeiro',
        contractId: 72,
        expected: 920,
        received: 920,
        expectedProfit: 138,
        realizedProfit: 138,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 4,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'Thiago Moreira',
        contractId: 70,
        expected: 680,
        received: 400,
        expectedProfit: 102,
        realizedProfit: 60,
        status: 'partial',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 5,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'Maria Oliveira Santos',
        contractId: 47,
        expected: 550,
        received: 300,
        expectedProfit: 82.5,
        realizedProfit: 45,
        status: 'partial',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 6,
        date: '2026-08-25',
        paymentDate: '2026-08-25',
        client: 'Ricardo Martins',
        contractId: 62,
        expected: 740,
        received: 500,
        expectedProfit: 111,
        realizedProfit: 75,
        status: 'partial',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 7,
        date: '2026-08-25',
        paymentDate: '',
        client: 'Carlos Henrique Souza',
        contractId: 46,
        expected: 1150,
        received: 0,
        expectedProfit: 172.5,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 8,
        lateFee: 92,
    },
    {
        id: 8,
        date: '2026-08-25',
        paymentDate: '',
        client: 'Pedro Almeida',
        contractId: 41,
        expected: 660,
        received: 0,
        expectedProfit: 99,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 3,
        lateFee: 54,
    },
    {
        id: 9,
        date: '2026-08-25',
        paymentDate: '',
        client: 'André Moraes',
        contractId: 68,
        expected: 1050,
        received: 0,
        expectedProfit: 157,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 6,
        lateFee: 84,
    },
    {
        id: 10,
        date: '2026-08-25',
        paymentDate: '',
        client: 'Eduardo Campos',
        contractId: 63,
        expected: 970,
        received: 0,
        expectedProfit: 145.5,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 4,
        lateFee: 68,
    },
    {
        id: 11,
        date: '2026-08-01',
        paymentDate: '2026-08-01',
        client: 'Felipe Martins',
        contractId: 52,
        expected: 720,
        received: 720,
        expectedProfit: 105,
        realizedProfit: 105,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 12,
        date: '2026-08-03',
        paymentDate: '2026-08-03',
        client: 'Rafael Almeida',
        contractId: 53,
        expected: 950,
        received: 950,
        expectedProfit: 135,
        realizedProfit: 135,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 13,
        date: '2026-08-05',
        paymentDate: '2026-08-05',
        client: 'Fernanda Souza',
        contractId: 56,
        expected: 840,
        received: 840,
        expectedProfit: 122,
        realizedProfit: 122,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 14,
        date: '2026-08-07',
        paymentDate: '2026-08-07',
        client: 'Marcelo Nunes',
        contractId: 61,
        expected: 880,
        received: 880,
        expectedProfit: 132,
        realizedProfit: 132,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 15,
        date: '2026-08-09',
        paymentDate: '',
        client: 'Augusto Prado',
        contractId: 73,
        expected: 620,
        received: 0,
        expectedProfit: 93,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 4,
        lateFee: 48,
    },
    {
        id: 16,
        date: '2026-08-12',
        paymentDate: '2026-08-12',
        client: 'Carolina Mendes',
        contractId: 65,
        expected: 810,
        received: 810,
        expectedProfit: 121,
        realizedProfit: 121,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 17,
        date: '2026-08-17',
        paymentDate: '2026-08-17',
        client: 'Isabela Rocha',
        contractId: 67,
        expected: 630,
        received: 630,
        expectedProfit: 94,
        realizedProfit: 94,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 18,
        date: '2026-08-20',
        paymentDate: '',
        client: 'Renato Carvalho',
        contractId: 74,
        expected: 1050,
        received: 0,
        expectedProfit: 157,
        realizedProfit: 0,
        status: 'unpaid',
        daysLate: 6,
        lateFee: 84,
    },
    {
        id: 19,
        date: '2026-08-23',
        paymentDate: '2026-08-23',
        client: 'Priscila Alves',
        contractId: 69,
        expected: 760,
        received: 760,
        expectedProfit: 114,
        realizedProfit: 114,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 20,
        date: '2026-08-27',
        paymentDate: '2026-08-27',
        client: 'Bruno Rodrigues',
        contractId: 75,
        expected: 560,
        received: 560,
        expectedProfit: 84,
        realizedProfit: 84,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
    {
        id: 21,
        date: '2026-08-30',
        paymentDate: '2026-08-30',
        client: 'Mariana Costa',
        contractId: 76,
        expected: 920,
        received: 920,
        expectedProfit: 138,
        realizedProfit: 138,
        status: 'paid',
        daysLate: 0,
        lateFee: 0,
    },
])

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

const periodRecords = computed(() =>
    payments.value.filter(
        (payment) =>
            payment.date >= periodRange.value.start &&
            payment.date <= periodRange.value.end,
    ),
)

const totalExpected = computed(() =>
    sum(
        periodRecords.value,
        'expected',
    ),
)

const totalReceived = computed(() =>
    sum(
        periodRecords.value,
        'received',
    ),
)

const totalPending = computed(() =>
    Math.max(
        totalExpected.value -
        totalReceived.value,
        0,
    ),
)

const expectedProfit = computed(() =>
    sum(
        periodRecords.value,
        'expectedProfit',
    ),
)

const realizedProfit = computed(() =>
    sum(
        periodRecords.value,
        'realizedProfit',
    ),
)

const pendingProfit = computed(() =>
    Math.max(
        expectedProfit.value -
        realizedProfit.value,
        0,
    ),
)

const paidRecords = computed(() =>
    periodRecords.value.filter(
        (payment) =>
            payment.status === 'paid',
    ),
)

const partialRecords = computed(() =>
    periodRecords.value.filter(
        (payment) =>
            payment.status === 'partial',
    ),
)

const unpaidRecords = computed(() =>
    periodRecords.value.filter(
        (payment) =>
            payment.status === 'unpaid',
    ),
)

const pendingRecords = computed(() =>
    periodRecords.value
        .filter(
            (payment) =>
                getOutstandingValue(payment) > 0,
        )
        .sort(
            (first, second) =>
                second.daysLate -
                first.daysLate,
        ),
)

const receivedRecords = computed(() =>
    periodRecords.value.filter(
        (payment) =>
            payment.received > 0,
    ),
)

const totalLateFees = computed(() =>
    sum(
        periodRecords.value,
        'lateFee',
    ),
)

const largestDelay = computed(() =>
    periodRecords.value.reduce(
        (highest, payment) =>
            Math.max(
                highest,
                Number(payment.daysLate) || 0,
            ),
        0,
    ),
)

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

const averageReceipt = computed(() => {
    if (!receivedRecords.value.length) {
        return 0
    }

    return (
        totalReceived.value /
        receivedRecords.value.length
    )
})

const financialCards = computed(() => [
    {
        key: 'expected',
        label: 'Previsto para receber',
        value: formatCurrency(
            totalExpected.value,
        ),
        icon: 'mdi-cash-clock',
        iconBackground: 'bg-[#f2f4f1]',
        iconColor: 'text-[#4e6847]',
        valueClass: 'text-[#27272a]',
        detail: '',
        detailClass: '',
    },
    {
        key: 'received',
        label: 'Total recebido',
        value: formatCurrency(
            totalReceived.value,
        ),
        icon: 'mdi-cash-check',
        iconBackground: 'bg-[#edf7ef]',
        iconColor: 'text-[#166534]',
        valueClass: 'text-[#166534]',
        detail: `${formatPercentage(receiptRate.value)} do valor previsto`,
        detailClass: 'text-[#166534]/70',
    },
    {
        key: 'pending',
        label: 'Falta receber',
        value: formatCurrency(
            totalPending.value,
        ),
        icon: 'mdi-cash-remove',
        iconBackground:
            totalPending.value > 0
                ? 'bg-[#fef2f2]'
                : 'bg-[#edf7ef]',
        iconColor:
            totalPending.value > 0
                ? 'text-[#b91c1c]'
                : 'text-[#166534]',
        valueClass:
            totalPending.value > 0
                ? 'text-[#b91c1c]'
                : 'text-[#166534]',
        detail: '',
        detailClass: '',
    },
    {
        key: 'expected-profit',
        label: 'Lucro previsto',
        value: formatCurrency(
            expectedProfit.value,
        ),
        icon: 'mdi-chart-line',
        iconBackground: 'bg-[#f4f3ec]',
        iconColor: 'text-[#7c6f35]',
        valueClass: 'text-[#27272a]',
        detail: '',
        detailClass: '',
    },
    {
        key: 'realized-profit',
        label: 'Lucro realizado',
        value: formatCurrency(
            realizedProfit.value,
        ),
        icon: 'mdi-finance',
        iconBackground: 'bg-[#edf7ef]',
        iconColor: 'text-[#166534]',
        valueClass: 'text-[#166534]',
        detail: `${formatPercentage(profitRate.value)} do lucro previsto`,
        detailClass: 'text-[#166534]/70',
    },
])

const paymentIndicators = computed(() => [
    {
        key: 'expected',
        label: 'Pagamentos previstos',
        value: periodRecords.value.length,
        icon: 'mdi-calendar-clock-outline',
        iconClass: 'text-black/40',
        percentage: null,
        percentageClass: '',
    },
    {
        key: 'paid',
        label: 'Pagamentos realizados',
        value: paidRecords.value.length,
        icon: 'mdi-check-circle-outline',
        iconClass: 'text-[#166534]',
        percentage: getPercentage(
            paidRecords.value.length,
            periodRecords.value.length,
        ),
        percentageClass: 'text-[#166534]',
    },
    {
        key: 'partial',
        label: 'Pagamentos parciais',
        value: partialRecords.value.length,
        icon: 'mdi-circle-half-full',
        iconClass: 'text-[#d18a28]',
        percentage: getPercentage(
            partialRecords.value.length,
            periodRecords.value.length,
        ),
        percentageClass: 'text-[#b45309]',
    },
    {
        key: 'unpaid',
        label: 'Não pagos',
        value: unpaidRecords.value.length,
        icon: 'mdi-alert-circle-outline',
        iconClass: 'text-[#c24141]',
        percentage: getPercentage(
            unpaidRecords.value.length,
            periodRecords.value.length,
        ),
        percentageClass: 'text-[#b91c1c]',
    },
])

const paymentStatusItems = computed(() => {
    const total =
        periodRecords.value.length

    const items = [
        {
            key: 'paid',
            label: 'Pagos',
            value: paidRecords.value.length,
            color: '#166534',
        },
        {
            key: 'partial',
            label: 'Parciais',
            value:
                partialRecords.value.length,
            color: '#d99732',
        },
        {
            key: 'unpaid',
            label: 'Não pagos',
            value:
                unpaidRecords.value.length,
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

const searchedPeriodRecords = computed(() => {
    let records =
        periodRecords.value

    if (
        selectedPaymentStatus.value !==
        'all'
    ) {
        records = records.filter(
            (payment) =>
                payment.status ===
                selectedPaymentStatus.value,
        )
    }

    const term =
        search.value
            .trim()
            .toLowerCase()

    if (!term) {
        return records
    }

    return records.filter(
        (payment) => {
            const values = [
                payment.client,
                String(
                    payment.contractId,
                ),
                getStatusLabel(
                    payment.status,
                ),
                payment.date,
                payment.paymentDate,
            ]

            return values.some(
                (value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
            )
        },
    )
})

const sortedPeriodRecords = computed(() => {
    return [
        ...searchedPeriodRecords.value,
    ].sort(
        (first, second) => {
            const firstValue =
                getSortValue(
                    first,
                    sortKey.value,
                )

            const secondValue =
                getSortValue(
                    second,
                    sortKey.value,
                )

            let comparison = 0

            if (
                typeof firstValue ===
                'number' &&
                typeof secondValue ===
                'number'
            ) {
                comparison =
                    firstValue -
                    secondValue
            } else {
                comparison =
                    String(firstValue)
                        .localeCompare(
                            String(
                                secondValue,
                            ),
                            'pt-BR',
                            {
                                numeric: true,
                                sensitivity:
                                    'base',
                            },
                        )
            }

            return (
                sortDirection.value ===
                    'asc'
                    ? comparison
                    : -comparison
            )
        },
    )
})

const chartItems = computed(() => {
    if (reportMode.value === 'day') {
        return [
            createChartItem(
                dayDate.value,
            ),
        ]
    }

    if (reportMode.value === 'week') {
        const start =
            parseDate(
                weekStartDate.value,
            )

        const end =
            parseDate(
                weekEndDate.value,
            )

        if (!start || !end) {
            return []
        }

        const amount = Math.max(
            1,
            Math.min(
                getDaysDifference(
                    start,
                    end,
                ) + 1,
                7,
            ),
        )

        return createDailyChartItems(
            start,
            amount,
        )
    }

    return createMonthlyChartItems()
})

const chartDescription = computed(() => {
    if (reportMode.value === 'day') {
        return 'Total recebido na data selecionada.'
    }

    if (reportMode.value === 'week') {
        return 'Recebimentos por dia dentro do período selecionado.'
    }

    return 'Recebimentos agrupados por semana dentro do mês selecionado.'
})

function createChartItem(
    value,
) {
    const date =
        parseDate(value)

    if (!date) {
        return {
            id: value,
            label: '—',
            fullLabel: 'Data inválida',
            value: 0,
        }
    }

    const total = payments.value
        .filter(
            (payment) =>
                payment.date === value,
        )
        .reduce(
            (sumValue, payment) =>
                sumValue +
                Number(
                    payment.received,
                ),
            0,
        )

    return {
        id: value,
        date: value,
        label:
            reportMode.value === 'day'
                ? formatDayMonth(value)
                : formatWeekday(value),
        fullLabel:
            formatLongDate(value),
        value: total,
    }
}

function createDailyChartItems(
    start,
    amount,
) {
    return Array.from(
        {
            length: amount,
        },
        (_, index) => {
            const date =
                new Date(start)

            date.setUTCDate(
                start.getUTCDate() +
                index,
            )

            return createChartItem(
                formatIsoDate(date),
            )
        },
    )
}

function createMonthlyChartItems() {
    const amountOfDays =
        new Date(
            Date.UTC(
                selectedYear.value,
                selectedMonth.value,
                0,
            ),
        ).getUTCDate()

    const groups = [
        [1, 7],
        [8, 14],
        [15, 21],
        [22, 28],
        [29, amountOfDays],
    ].filter(
        ([start]) =>
            start <= amountOfDays,
    )

    return groups.map(
        (
            [
                startDay,
                endDay,
            ],
            index,
        ) => {
            const safeEnd =
                Math.min(
                    endDay,
                    amountOfDays,
                )

            const startDate =
                formatDateParts(
                    selectedYear.value,
                    selectedMonth.value,
                    startDay,
                )

            const endDate =
                formatDateParts(
                    selectedYear.value,
                    selectedMonth.value,
                    safeEnd,
                )

            const value =
                payments.value
                    .filter(
                        (payment) =>
                            payment.date >=
                            startDate &&
                            payment.date <=
                            endDate,
                    )
                    .reduce(
                        (
                            total,
                            payment,
                        ) =>
                            total +
                            Number(
                                payment.received,
                            ),
                        0,
                    )

            return {
                id: `week-${index}`,
                label: `${String(startDay).padStart(2, '0')}–${String(safeEnd).padStart(2, '0')}`,
                fullLabel: `${startDay} a ${safeEnd} de ${months[selectedMonth.value - 1].label.toLowerCase()}`,
                value,
            }
        },
    )
}

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

function getSortValue(
    payment,
    key,
) {
    if (key === 'pending') {
        return getOutstandingValue(
            payment,
        )
    }

    if (key === 'status') {
        const order = {
            paid: 1,
            partial: 2,
            unpaid: 3,
        }

        return (
            order[
            payment.status
            ] ?? 99
        )
    }

    if (
        key === 'expected' ||
        key === 'received' ||
        key === 'contractId'
    ) {
        return Number(
            payment[key] ?? 0,
        )
    }

    return payment[key] ?? ''
}

function changeReportMode(mode) {
    reportMode.value = mode
}

function sum(
    records,
    property,
) {
    return records.reduce(
        (total, record) =>
            total +
            Number(
                record[property] || 0,
            ),
        0,
    )
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

function getOutstandingValue(
    payment,
) {
    return Math.max(
        Number(payment.expected) -
        Number(
            payment.received,
        ),
        0,
    )
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

function getDaysDifference(
    start,
    end,
) {
    const milliseconds =
        end.getTime() -
        start.getTime()

    return Math.floor(
        milliseconds /
        86400000,
    )
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