<template>
    <div ref="containerRef" class="relative">
        <label class="mb-1.5 block text-sm font-medium text-[#202124]">
            Cliente
        </label>

        <div class="relative">
            <i
                class="mdi mdi-magnify pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-black/35" />

            <input v-model="search" type="text" autocomplete="off" placeholder="Pesquise por nome ou CPF"
                class="h-11 w-full rounded-lg border border-black/10 bg-white pl-10 pr-10 text-sm text-[#202124] outline-none transition focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
                @focus="isOpen = true" />

            <button v-if="search" type="button"
                class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-black/35 transition hover:bg-black/[0.04] hover:text-black/60"
                @click="clearSelection">
                <i class="mdi mdi-close text-lg" />
            </button>
        </div>

        <Transition name="client-dropdown">
            <div v-if="isOpen"
                class="absolute left-0 right-0 top-[72px] z-30 max-h-64 overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.12)]">
                <button v-for="client in filteredClients" :key="client.id" type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-black/[0.035]"
                    @click="selectClient(client)">
                    <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-[#202124]">
                            {{ client.name }}
                        </p>

                        <p class="mt-0.5 text-xs text-black/45">
                            {{ client.cpf }}
                        </p>
                    </div>

                    <i v-if="client.id === modelValue" class="mdi mdi-check text-lg text-[#166534]" />
                </button>

                <div v-if="!filteredClients.length" class="px-3 py-6 text-center">
                    <i class="mdi mdi-account-search-outline text-2xl text-black/25" />

                    <p class="mt-1 text-sm text-black/45">
                        Nenhum cliente encontrado
                    </p>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
    modelValue: {
        type: [Number, String, null],
        default: null
    },
    clients: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
const isOpen = ref(false)
const search = ref('')

const selectedClient = computed(() =>
    props.clients.find((client) => client.id === props.modelValue)
)

const filteredClients = computed(() => {
    const term = search.value
        .toLowerCase()
        .replace(/\D/g, '')

    const rawTerm = search.value.toLowerCase().trim()

    if (!rawTerm) {
        return props.clients
    }

    return props.clients.filter((client) => {
        const nameMatches = client.name.toLowerCase().includes(rawTerm)

        const cpfMatches = client.cpf
            .replace(/\D/g, '')
            .includes(term)

        return nameMatches || cpfMatches
    })
})

const selectClient = (client) => {
    emit('update:modelValue', client.id)
    search.value = client.name
    isOpen.value = false
}

const clearSelection = () => {
    search.value = ''
    emit('update:modelValue', null)
    isOpen.value = true
}

const handleOutsideClick = (event) => {
    if (
        containerRef.value &&
        !containerRef.value.contains(event.target)
    ) {
        isOpen.value = false
    }
}

watch(
    selectedClient,
    (client) => {
        if (client) {
            search.value = client.name
        }
    },
    { immediate: true }
)

watch(
    () => props.modelValue,
    (value) => {
        if (!value) {
            search.value = ''
        }
    }
)

onMounted(() => {
    document.addEventListener('mousedown', handleOutsideClick)
})

onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.client-dropdown-enter-active,
.client-dropdown-leave-active {
    transition:
        opacity 150ms ease,
        transform 150ms ease;
}

.client-dropdown-enter-from,
.client-dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>