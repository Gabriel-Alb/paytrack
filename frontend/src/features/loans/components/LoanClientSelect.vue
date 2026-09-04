<template>
    <div
        ref="root"
        class="relative min-w-0"
    >
        <span class="mb-1.5 block text-sm font-medium text-[#202124]">
            Nome
        </span>

        <div
            class="relative flex h-11 min-w-0 w-full items-center overflow-hidden rounded-lg border border-black/10 bg-white transition-[border-color,box-shadow] focus-within:border-[#166534] focus-within:ring-2 focus-within:ring-[#166534]/10"
        >
            <input
                v-model="query"
                type="text"
                autocomplete="off"
                placeholder="Digite o nome do cliente"
                class="h-full min-w-0 flex-1 bg-transparent px-3 pr-12 text-sm text-[#202124] outline-none placeholder:text-black/30"
                @focus="openDropdown"
                @input="handleInput"
            />

            <button
                type="button"
                class="absolute right-0 top-0 flex h-full w-11 shrink-0 items-center justify-center border-l border-black/[0.06] bg-white text-[#166534] transition-colors hover:bg-[#166534]/[0.05] active:bg-[#166534]/[0.08]"
                aria-label="Cadastrar novo cliente"
                title="Cadastrar novo cliente"
                @click.stop="requestNewClient"
            >
                <span
                    class="mdi mdi-account-plus-outline text-xl"
                    aria-hidden="true"
                />
            </button>
        </div>

        <div
            v-if="dropdownOpen"
            class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)]"
        >
            <div
                v-if="filteredClients.length"
                class="max-h-[220px] overflow-y-auto overscroll-contain py-1"
            >
                <button
                    v-for="client in filteredClients"
                    :key="client.id"
                    type="button"
                    class="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03]"
                    :class="{
                        'bg-[#166534]/[0.05]':
                            String(client.id) === String(modelValue),
                    }"
                    @click="selectClient(client)"
                >
                    <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-[#27272a]">
                            {{ client.name }}
                        </p>

                        <p
                            v-if="client.cpf"
                            class="mt-0.5 truncate text-[11px] text-black/40"
                        >
                            CPF: {{ client.cpf }}
                        </p>
                    </div>

                    <span
                        v-if="String(client.id) === String(modelValue)"
                        class="mdi mdi-check shrink-0 text-lg text-[#166534]"
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div
                v-else
                class="px-4 py-5 text-center"
            >
                <p class="text-sm text-black/45">
                    Nenhum cliente encontrado.
                </p>

                <button
                    type="button"
                    class="mt-2 text-xs font-semibold text-[#166534]"
                    @click="requestNewClient"
                >
                    Cadastrar novo cliente
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue'

const props = defineProps({
    modelValue: {
        type: [Number, String],
        default: null,
    },

    clients: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits([
    'update:modelValue',
    'request-new-client',
])

const root = ref(null)
const query = ref('')
const dropdownOpen = ref(false)

const selectedClient = computed(() =>
    props.clients.find(
        (client) =>
            String(client.id) === String(props.modelValue),
    ),
)

const filteredClients = computed(() => {
    const term = query.value
        .trim()
        .toLowerCase()

    if (!term) {
        return props.clients
    }

    return props.clients.filter((client) => {
        const name =
            client.name?.toLowerCase() ?? ''

        const cpf =
            client.cpf?.toLowerCase() ?? ''

        return (
            name.includes(term) ||
            cpf.includes(term)
        )
    })
})

function openDropdown() {
    dropdownOpen.value = true
}

function handleInput() {
    dropdownOpen.value = true

    if (
        selectedClient.value &&
        query.value !== selectedClient.value.name
    ) {
        emit('update:modelValue', null)
    }
}

function selectClient(client) {
    query.value = client.name

    emit(
        'update:modelValue',
        client.id,
    )

    dropdownOpen.value = false
}

function requestNewClient() {
    dropdownOpen.value = false

    emit('request-new-client')
}

function handleOutsideClick(event) {
    if (
        !dropdownOpen.value ||
        root.value?.contains(event.target)
    ) {
        return
    }

    dropdownOpen.value = false

    if (selectedClient.value) {
        query.value =
            selectedClient.value.name
    }
}

watch(
    selectedClient,
    (client) => {
        if (client) {
            query.value = client.name
            return
        }

        if (!props.modelValue) {
            query.value = ''
        }
    },
    {
        immediate: true,
    },
)

onMounted(() => {
    document.addEventListener(
        'pointerdown',
        handleOutsideClick,
    )
})

onBeforeUnmount(() => {
    document.removeEventListener(
        'pointerdown',
        handleOutsideClick,
    )
})
</script>