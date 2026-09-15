<template>
    <BaseModal :model-value="modelValue" :title="client
        ? 'Editar cliente'
        : 'Novo cliente'
        " :description="client
            ? 'Atualize os dados cadastrais.'
            : 'Preencha as informações do novo cliente.'
            " panel-class="sm:max-w-[590px]" @update:model-value="
                emit('update:modelValue', $event)
                " @close="emit('close')">
        <form id="client-form" @submit.prevent="submit">
            <div class="grid gap-4 sm:grid-cols-2">
                <label class="sm:col-span-2">
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        Nome completo
                    </span>

                    <input v-model.trim="form.name" type="text" required placeholder="Nome do cliente"
                        :class="inputClass" />
                </label>

                <label>
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        CPF
                    </span>

                    <input v-model.trim="form.cpf" type="text" required placeholder="000.000.000-00"
                        :class="inputClass" />
                </label>

                <label>
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        RG
                    </span>

                    <input v-model.trim="form.rg" type="text" placeholder="00.000.000-0" :class="inputClass" />
                </label>

                <label>
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        Telefone
                    </span>

                    <input v-model.trim="form.phone" type="tel" required placeholder="(11) 99999-9999"
                        :class="inputClass" />
                </label>

                <label>
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        CNH
                    </span>

                    <input v-model.trim="form.cnh" type="text" placeholder="Número da CNH" :class="inputClass" />
                </label>

                <label class="sm:col-span-2">
                    <span class="mb-1.5 block text-xs font-medium text-black/50">
                        E-mail
                    </span>

                    <input v-model.trim="form.email" type="email" placeholder="cliente@email.com" :class="inputClass" />
                </label>
            </div>
        </form>

        <template #footer>
            <button type="button" :class="secondaryButtonClass" @click="
                emit('update:modelValue', false)
                ">
                Cancelar
            </button>

            <button type="submit" form="client-form" :class="primaryButtonClass">
                {{
                    client
                        ? 'Salvar alterações'
                        : 'Cadastrar cliente'
                }}
            </button>
        </template>
    </BaseModal>
</template>

<script setup>
import {
    reactive,
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

const inputClass =
    'h-[46px] w-full rounded-[10px] border border-black/[0.09] bg-[#f8f8f8] px-3 text-base text-[#202124] outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-black/30 focus:border-[#166534]/45 focus:bg-white focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)] sm:h-10 sm:text-sm'

const primaryButtonClass =
    'inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#166534] bg-[#166534] px-4 text-[13px] font-semibold text-white transition-colors active:bg-[#14532d] sm:min-h-[38px]'

const secondaryButtonClass =
    'inline-flex min-h-11 items-center justify-center rounded-[10px] border border-black/[0.09] bg-white px-4 text-[13px] font-semibold text-black/55 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] sm:min-h-[38px]'

const form = reactive({
    name: '',
    cpf: '',
    rg: '',
    phone: '',
    email: '',
    cnh: '',
})

function resetForm() {
    Object.assign(form, {
        name: props.client?.name ?? '',
        cpf: props.client?.cpf ?? '',
        rg: props.client?.rg ?? '',
        phone: props.client?.phone ?? '',
        email: props.client?.email ?? '',
        cnh: props.client?.cnh ?? '',
    })
}

function submit() {
    emit('save', {
        name: form.name,
        cpf: form.cpf,
        rg: form.rg,
        phone: form.phone,
        email: form.email,
        cnh: form.cnh,
    })
}

watch(
    [
        () => props.modelValue,
        () => props.client,
    ],
    ([open]) => {
        if (open) {
            resetForm()
        }
    },
    {
        immediate: true,
    },
)
</script>