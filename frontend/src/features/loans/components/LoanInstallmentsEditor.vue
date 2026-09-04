<template>
    <div class="rounded-xl border border-black/[0.07] bg-[#fafafa] p-4">
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-sm font-medium text-[#202124]">
                    Valores das parcelas
                </p>

                <p class="mt-1 text-xs leading-5 text-black/45">
                    Você pode alterar parcelas. As demais serão reajustadas automaticamente.
                </p>
            </div>

            <div class="shrink-0 text-right">
                <p class="text-xs text-black/40">
                    Total
                </p>

                <p class="mt-0.5 text-sm font-semibold text-[#166534]">
                    {{ formatCurrency(currentTotal) }}
                </p>
            </div>
        </div>

        <div v-if="installments.length" class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-2">
                <label v-for="item in installmentColumns[0]" :key="item.index"
                    class="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-3 py-2.5">
                    <span
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#166534]/[0.07] text-xs font-semibold text-[#166534]">
                        {{ item.index + 1 }}
                    </span>

                    <div class="min-w-0 flex-1">
                        <span class="mb-0.5 block text-[11px] text-black/40">
                            Parcela {{ item.index + 1 }}
                        </span>

                        <div class="flex items-center">
                            <span class="mr-1 text-sm text-black/40">
                                R$
                            </span>

                            <input :value="formatInputValue(item.value)" type="number" min="0" step="0.01"
                                class="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#202124] outline-none"
                                @change="
                                    updateInstallment(
                                        item.index,
                                        $event.target.value,
                                    )
                                    " />
                        </div>
                    </div>
                </label>
            </div>

            <div class="flex min-w-0 flex-col gap-2">
                <label v-for="item in installmentColumns[1]" :key="item.index"
                    class="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-3 py-2.5">
                    <span
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#166534]/[0.07] text-xs font-semibold text-[#166534]">
                        {{ item.index + 1 }}
                    </span>

                    <div class="min-w-0 flex-1">
                        <span class="mb-0.5 block text-[11px] text-black/40">
                            Parcela {{ item.index + 1 }}
                        </span>

                        <div class="flex items-center">
                            <span class="mr-1 text-sm text-black/40">
                                R$
                            </span>

                            <input :value="formatInputValue(item.value)" type="number" min="0" step="0.01"
                                class="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#202124] outline-none"
                                @change="
                                    updateInstallment(
                                        item.index,
                                        $event.target.value,
                                    )
                                    " />
                        </div>
                    </div>
                </label>
            </div>
        </div>

        <div v-else class="mt-4 rounded-lg border border-dashed border-black/10 py-5 text-center text-sm text-black/40">
            Informe o valor e a quantidade de parcelas.
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => [],
    },

    overrides: {
        type: Object,
        default: () => ({}),
    },

    total: {
        type: Number,
        default: 0,
    },

    count: {
        type: Number,
        default: 0,
    },
})

const emit = defineEmits([
    'update:modelValue',
    'update:overrides',
])

const installments = ref([])

const currentTotal = computed(() =>
    installments.value.reduce(
        (sum, installment) =>
            sum + Number(installment || 0),
        0,
    ),
)

const installmentColumns = computed(() => {
    const middle = Math.ceil(
        installments.value.length / 2,
    )

    const items = installments.value.map(
        (value, index) => ({
            index,
            value,
        }),
    )

    return [
        items.slice(0, middle),
        items.slice(middle),
    ]
})

function toCents(value) {
    return Math.max(
        Math.round(
            (Number(value) || 0) * 100,
        ),
        0,
    )
}

function fromCents(value) {
    return Number(
        (value / 100).toFixed(2),
    )
}

function normalizeCount(value) {
    const count =
        Number.parseInt(value, 10) || 0

    return Math.min(
        Math.max(count, 0),
        120,
    )
}

function calculateInstallments(overrides = {}) {
    const count =
        normalizeCount(props.count)

    const totalCents =
        toCents(props.total)

    if (!count || !totalCents) {
        return {
            installments: [],
            overrides: {},
        }
    }

    const validOverrides = {}

    Object.entries(overrides).forEach(
        ([index, value]) => {
            const normalizedIndex =
                Number(index)

            if (
                Number.isInteger(normalizedIndex) &&
                normalizedIndex >= 0 &&
                normalizedIndex < count
            ) {
                validOverrides[normalizedIndex] =
                    fromCents(
                        toCents(value),
                    )
            }
        },
    )

    const overrideEntries =
        Object.entries(validOverrides)
            .map(([index, value]) => [
                Number(index),
                toCents(value),
            ])
            .sort(
                (
                    [firstIndex],
                    [secondIndex],
                ) =>
                    firstIndex -
                    secondIndex,
            )

    const normalizedOverrides = {}

    let availableTotal =
        totalCents

    overrideEntries.forEach(
        ([index, value]) => {
            const normalizedValue =
                Math.min(
                    value,
                    availableTotal,
                )

            normalizedOverrides[index] =
                fromCents(
                    normalizedValue,
                )

            availableTotal -=
                normalizedValue
        },
    )

    const values =
        Array(count).fill(0)

    let fixedTotal = 0

    Object.entries(
        normalizedOverrides,
    ).forEach(
        ([index, value]) => {
            const valueCents =
                toCents(value)

            values[Number(index)] =
                valueCents

            fixedTotal +=
                valueCents
        },
    )

    const automaticIndexes = []

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        if (
            normalizedOverrides[index] ===
            undefined
        ) {
            automaticIndexes.push(
                index,
            )
        }
    }

    const remaining =
        Math.max(
            totalCents -
            fixedTotal,
            0,
        )

    if (automaticIndexes.length) {
        const baseValue =
            Math.floor(
                remaining /
                automaticIndexes.length,
            )

        let centsRemaining =
            remaining %
            automaticIndexes.length

        automaticIndexes.forEach(
            (index) => {
                values[index] =
                    baseValue

                if (
                    centsRemaining >
                    0
                ) {
                    values[index] += 1
                    centsRemaining -= 1
                }
            },
        )
    } else if (
        count > 0 &&
        remaining > 0
    ) {
        const lastIndex =
            count - 1

        values[lastIndex] +=
            remaining

        normalizedOverrides[lastIndex] =
            fromCents(
                values[lastIndex],
            )
    }

    return {
        installments:
            values.map(fromCents),

        overrides:
            normalizedOverrides,
    }
}

function applyDistribution(overrides) {
    const result =
        calculateInstallments(
            overrides,
        )

    installments.value =
        result.installments

    emit(
        'update:modelValue',
        [...result.installments],
    )

    emit(
        'update:overrides',
        {
            ...result.overrides,
        },
    )
}

function updateInstallment(
    index,
    value,
) {
    const totalCents =
        toCents(props.total)

    const nextOverrides = {
        ...props.overrides,
    }

    let otherFixedTotal = 0

    Object.entries(
        nextOverrides,
    ).forEach(
        ([
            overrideIndex,
            overrideValue,
        ]) => {
            if (
                Number(
                    overrideIndex,
                ) === index
            ) {
                return
            }

            otherFixedTotal +=
                toCents(
                    overrideValue,
                )
        },
    )

    const maximumValue =
        Math.max(
            totalCents -
            otherFixedTotal,
            0,
        )

    const requestedValue =
        Math.min(
            toCents(value),
            maximumValue,
        )

    nextOverrides[index] =
        fromCents(
            requestedValue,
        )

    applyDistribution(
        nextOverrides,
    )
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

function formatInputValue(value) {
    return Number(
        value || 0,
    ).toFixed(2)
}

watch(
    [
        () => props.total,
        () => props.count,
    ],
    () => {
        applyDistribution(
            props.overrides,
        )
    },
    {
        immediate: true,
    },
)

watch(
    () => props.modelValue,
    (value) => {
        if (
            !Array.isArray(value)
        ) {
            return
        }

        if (
            value.length ===
            installments.value.length &&
            value.every(
                (
                    installment,
                    index,
                ) =>
                    Number(
                        installment,
                    ) ===
                    Number(
                        installments
                            .value[index],
                    ),
            )
        ) {
            return
        }

        installments.value = [
            ...value,
        ]
    },
    {
        deep: true,
    },
)
</script>
