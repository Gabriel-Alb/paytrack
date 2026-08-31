<template>
    <div class="rounded-xl border border-black/[0.07] bg-[#fafafa] p-4">
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-sm font-medium text-[#202124]">
                    Valores das parcelas
                </p>

                <p class="mt-1 text-xs leading-5 text-black/45">
                    Você pode alterar uma parcela. As demais serão reajustadas automaticamente.
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
            <label v-for="(installment, index) in installments" :key="index"
                class="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-3 py-2.5">
                <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#166534]/[0.07] text-xs font-semibold text-[#166534]">
                    {{ index + 1 }}
                </span>

                <div class="min-w-0 flex-1">
                    <span class="mb-0.5 block text-[11px] text-black/40">
                        Parcela {{ index + 1 }}
                    </span>

                    <div class="flex items-center">
                        <span class="mr-1 text-sm text-black/40">
                            R$
                        </span>

                        <input :value="formatInputValue(installment)" type="number" min="0" step="0.01"
                            class="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#202124] outline-none"
                            @change="updateInstallment(index, $event.target.value)" />
                    </div>
                </div>
            </label>
        </div>

        <div v-else class="mt-4 rounded-lg border border-dashed border-black/10 py-5 text-center text-sm text-black/40">
            Informe o valor e a quantidade de parcelas.
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
    distributeInstallments,
    rebalanceInstallments
} from '../utils/loanCalculations'

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    total: {
        type: Number,
        default: 0
    },
    count: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['update:modelValue'])

const installments = ref([])

const currentTotal = computed(() =>
    installments.value.reduce(
        (sum, installment) => sum + Number(installment || 0),
        0
    )
)

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0)

const formatInputValue = (value) =>
    Number(value || 0).toFixed(2)

const updateInstallment = (index, value) => {
    installments.value = rebalanceInstallments(
        installments.value,
        index,
        value,
        props.total
    )

    emit('update:modelValue', [...installments.value])
}

watch(
    () => [props.total, props.count],
    () => {
        installments.value = distributeInstallments(
            props.total,
            props.count
        )

        emit('update:modelValue', [...installments.value])
    },
    { immediate: true }
)
</script>