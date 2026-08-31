<template>
    <BaseModal :model-value="modelValue" title="Alterar status" :description="client?.name || ''"
        icon="mdi mdi-account-star" panel-class="sm:max-w-[460px]" @update:model-value="
            emit('update:modelValue', $event)
            " @close="emit('close')">
        <p class="mb-3 text-xs font-medium text-black/45">
            Escolha o novo status
        </p>

        <div class="space-y-2">
            <button v-for="status in statusOptions" :key="status.value" type="button"
                class="flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color] duration-150"
                :class="selectedStatus ===
                        status.value
                        ? 'border-[#166534]/30 bg-[#166534]/[0.055]'
                        : 'border-black/[0.08] bg-white hover:bg-black/[0.015]'
                    " @click="
                    selectedStatus =
                    status.value
                    ">
                <div class="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                    :class="selectedStatus ===
                            status.value
                            ? 'border-[#166534] bg-[#166534] text-white'
                            : 'border-black/[0.16] text-transparent'
                        ">
                    <span v-if="
                        selectedStatus ===
                        status.value
                    " class="mdi mdi-check text-[17px]" />
                </div>

                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold" :class="selectedStatus ===
                            status.value
                            ? 'text-[#166534]'
                            : 'text-[#202124]'
                        ">
                        {{ status.label }}
                    </p>

                    <p class="mt-0.5 text-xs leading-4 text-black/35">
                        {{ status.description }}
                    </p>
                </div>
            </button>
        </div>

        <template #footer>
            <button type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-black/[0.09] bg-white px-4 text-[13px] font-semibold text-black/55 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] sm:min-h-[38px]"
                @click="
                    emit(
                        'update:modelValue',
                        false,
                    )
                    ">
                Cancelar
            </button>

            <button type="button"
                class="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#166534] bg-[#166534] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#14532d] active:bg-[#14532d] sm:min-h-[38px]"
                @click="save">
                Salvar status
            </button>
        </template>
    </BaseModal>
</template>

<script setup>
import {
    ref,
    watch,
} from 'vue'

import BaseModal from '@/components/base/BaseModal.vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },

    client: {
        type: Object,
        default: null,
    },
})

const emit = defineEmits([
    'update:modelValue',
    'save',
    'close',
])

const selectedStatus = ref('ativo')

const statusOptions = [
    {
        value: 'ativo',
        label: 'Ativo',
        description:
            'Cliente ativo e liberado no sistema.',
    },
    {
        value: 'quitado',
        label: 'Quitado',
        description:
            'Cliente sem pendências financeiras.',
    },
    {
        value: 'negativado',
        label: 'Negativado',
        description:
            'Cliente com restrição ou pendência financeira.',
    },
]

function save() {
    emit(
        'save',
        selectedStatus.value,
    )
}

watch(
    [
        () => props.modelValue,
        () => props.client,
    ],
    ([open]) => {
        if (
            open &&
            props.client
        ) {
            selectedStatus.value =
                props.client.status
        }
    },
    {
        immediate: true,
    },
)
</script>