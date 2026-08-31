<template>
    <Teleport to="body">
        <Transition name="modal-backdrop">
            <div v-if="open" class="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px]" @click="close" />
        </Transition>

        <Transition name="modal-content">
            <div v-if="open"
                class="pointer-events-none fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
                <div class="pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-[620px] sm:rounded-2xl"
                    :style="sheetStyle">
                    <button type="button" class="flex w-full touch-none justify-center pb-2 pt-3 sm:hidden"
                        @pointerdown="startDrag">
                        <span class="h-1.5 w-11 rounded-full bg-black/15" />
                    </button>

                    <header
                        class="flex items-start justify-between gap-4 border-b border-black/[0.06] px-5 pb-4 pt-2 sm:p-5">
                        <div>
                            <h2 class="text-lg font-semibold text-[#202124]">
                                Novo cliente
                            </h2>

                            <p class="mt-1 text-sm text-black/45">
                                Cadastre o cliente para continuar o empréstimo.
                            </p>
                        </div>

                        <button type="button"
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/[0.04] hover:text-black/65"
                            @click="close">
                            <i class="mdi mdi-close text-xl" />
                        </button>
                    </header>

                    <form class="min-h-0 flex-1 overflow-y-auto p-5" @submit.prevent="submit">
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label class="sm:col-span-2">
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    Nome
                                </span>

                                <input v-model="form.name" required type="text"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="Nome completo" />
                            </label>

                            <label>
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    CPF
                                </span>

                                <input v-model="form.cpf" required type="text"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="000.000.000-00" />
                            </label>

                            <label>
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    RG
                                </span>

                                <input v-model="form.rg" type="text"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="RG" />
                            </label>

                            <label>
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    Telefone
                                </span>

                                <input v-model="form.phone" required type="text"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="(11) 99999-9999" />
                            </label>

                            <label>
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    CNH
                                </span>

                                <input v-model="form.cnh" type="text"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="Número da CNH" />
                            </label>

                            <label class="sm:col-span-2">
                                <span class="mb-1.5 block text-sm font-medium text-[#202124]">
                                    E-mail
                                </span>

                                <input v-model="form.email" type="email"
                                    class="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#202124] outline-none transition placeholder:text-black/30 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                                    placeholder="cliente@email.com" />
                            </label>
                        </div>

                        <div class="sticky bottom-0 mt-6 flex gap-3 border-t border-black/[0.06] bg-white pt-4">
                            <button type="button"
                                class="h-11 flex-1 rounded-lg border border-black/10 text-sm font-medium text-[#202124] transition hover:bg-black/[0.03]"
                                @click="close">
                                Cancelar
                            </button>

                            <button type="submit"
                                class="h-11 flex-1 rounded-lg bg-[#166534] text-sm font-medium text-white transition hover:bg-[#14532d]">
                                Cadastrar cliente
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { reactive } from 'vue'
import { useBottomSheetDrag } from '../composables/useBottomSheetDrag'

defineProps({
    open: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['close', 'save'])

const form = reactive({
    name: '',
    cpf: '',
    rg: '',
    phone: '',
    cnh: '',
    email: ''
})

const close = () => {
    emit('close')
}

const { sheetStyle, startDrag } = useBottomSheetDrag(close)

const submit = () => {
    emit('save', {
        ...form
    })

    Object.assign(form, {
        name: '',
        cpf: '',
        rg: '',
        phone: '',
        cnh: '',
        email: ''
    })
}
</script>

<style scoped>
.modal-backdrop-enter-active,
.modal-backdrop-leave-active {
    transition: opacity 200ms ease;
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
    opacity: 0;
}

.modal-content-enter-active,
.modal-content-leave-active {
    transition:
        opacity 220ms ease,
        transform 220ms ease;
}

.modal-content-enter-from,
.modal-content-leave-to {
    opacity: 0;
    transform: translateY(16px);
}
</style>