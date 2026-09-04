<template>
    <div ref="root" class="min-w-0 max-w-full">
        <span v-if="label" class="mb-1.5 block text-sm font-medium text-[#202124]">
            {{ label }}
        </span>

        <button type="button"
            class="flex h-11 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 text-left outline-none transition-[border-color,box-shadow] hover:border-black/[0.14] focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/10"
            :aria-expanded="open" @click="toggle">
            <span class="min-w-0 truncate text-sm" :class="modelValue
                    ? 'text-[#202124]'
                    : 'text-black/30'
                ">
                {{ displayValue }}
            </span>

            <span class="mdi mdi-calendar-month-outline shrink-0 text-lg text-black/35" aria-hidden="true" />
        </button>

        <div v-if="open"
            class="mt-2 w-full min-w-0 rounded-xl border border-black/[0.08] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div class="flex items-center justify-between gap-3">
                <button type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black/65"
                    aria-label="Mês anterior" @click="previousMonth">
                    <span class="mdi mdi-chevron-left text-xl" aria-hidden="true" />
                </button>

                <p class="min-w-0 truncate text-sm font-semibold capitalize text-[#27272a]">
                    {{ monthLabel }}
                </p>

                <button type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black/65"
                    aria-label="Próximo mês" @click="nextMonth">
                    <span class="mdi mdi-chevron-right text-xl" aria-hidden="true" />
                </button>
            </div>

            <div class="mt-3 grid grid-cols-7 gap-1">
                <span v-for="day in weekDays" :key="day"
                    class="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-black/35">
                    {{ day }}
                </span>

                <template v-for="(day, index) in calendarDays" :key="index">
                    <span v-if="!day" class="h-9" />

                    <button v-else type="button"
                        class="flex h-9 min-w-0 items-center justify-center rounded-lg text-xs font-medium transition-colors"
                        :class="day.value === modelValue
                                ? 'bg-[#166534] text-white'
                                : 'text-[#3f3f46] hover:bg-black/[0.04]'
                            " @click="selectDate(day.value)">
                        {{ day.day }}
                    </button>
                </template>
            </div>

            <div v-if="modelValue" class="mt-2 border-t border-black/[0.06] pt-2">
                <button type="button"
                    class="flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium text-black/45 transition-colors hover:bg-black/[0.03] hover:text-black/65"
                    @click="clear">
                    Limpar data
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
        type: String,
        default: '',
    },

    label: {
        type: String,
        default: '',
    },

    placeholder: {
        type: String,
        default: 'Selecione uma data',
    },
})

const emit = defineEmits([
    'update:modelValue',
])

const root = ref(null)
const open = ref(false)

const today = new Date()

const visibleYear = ref(
    today.getFullYear(),
)

const visibleMonth = ref(
    today.getMonth(),
)

const weekDays = [
    'Dom',
    'Seg',
    'Ter',
    'Qua',
    'Qui',
    'Sex',
    'Sáb',
]

const displayValue = computed(() => {
    if (!props.modelValue) {
        return props.placeholder
    }

    const [
        year,
        month,
        day,
    ] = props.modelValue
        .split('-')
        .map(Number)

    if (
        !year ||
        !month ||
        !day
    ) {
        return props.placeholder
    }

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'UTC',
        },
    ).format(
        new Date(
            Date.UTC(
                year,
                month - 1,
                day,
            ),
        ),
    )
})

const monthLabel = computed(() =>
    new Intl.DateTimeFormat(
        'pt-BR',
        {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        },
    ).format(
        new Date(
            Date.UTC(
                visibleYear.value,
                visibleMonth.value,
                1,
            ),
        ),
    ),
)

const calendarDays = computed(() => {
    const year = visibleYear.value
    const month = visibleMonth.value

    const firstDay =
        new Date(
            Date.UTC(
                year,
                month,
                1,
            ),
        ).getUTCDay()

    const amount =
        new Date(
            Date.UTC(
                year,
                month + 1,
                0,
            ),
        ).getUTCDate()

    const days = []

    for (
        let index = 0;
        index < firstDay;
        index += 1
    ) {
        days.push(null)
    }

    for (
        let day = 1;
        day <= amount;
        day += 1
    ) {
        days.push({
            day,
            value: formatDate(
                year,
                month + 1,
                day,
            ),
        })
    }

    return days
})

function formatDate(
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

function syncVisibleMonth() {
    if (!props.modelValue) {
        return
    }

    const [
        year,
        month,
    ] = props.modelValue
        .split('-')
        .map(Number)

    if (
        !year ||
        !month
    ) {
        return
    }

    visibleYear.value = year
    visibleMonth.value = month - 1
}

function toggle() {
    if (!open.value) {
        syncVisibleMonth()
    }

    open.value = !open.value
}

function previousMonth() {
    if (visibleMonth.value === 0) {
        visibleMonth.value = 11
        visibleYear.value -= 1
        return
    }

    visibleMonth.value -= 1
}

function nextMonth() {
    if (visibleMonth.value === 11) {
        visibleMonth.value = 0
        visibleYear.value += 1
        return
    }

    visibleMonth.value += 1
}

function selectDate(value) {
    emit(
        'update:modelValue',
        value,
    )

    open.value = false
}

function clear() {
    emit(
        'update:modelValue',
        '',
    )

    open.value = false
}

function handlePointerDown(event) {
    if (
        !open.value ||
        root.value?.contains(event.target)
    ) {
        return
    }

    open.value = false
}

watch(
    () => props.modelValue,
    syncVisibleMonth,
)

onMounted(() => {
    document.addEventListener(
        'pointerdown',
        handlePointerDown,
    )
})

onBeforeUnmount(() => {
    document.removeEventListener(
        'pointerdown',
        handlePointerDown,
    )
})
</script>