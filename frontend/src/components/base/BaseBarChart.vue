<template>
    <article class="relative overflow-visible rounded-xl border border-black/[0.07] bg-white p-4 sm:p-6">
        <header class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <h2 class="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#27272a] sm:text-base">
                    {{ title }}
                </h2>

                <p v-if="description" class="mt-1 text-[10px] text-[#8b8b93] sm:text-xs">
                    {{ description }}
                </p>
            </div>

            <slot name="header-action">
                <span v-if="badge"
                    class="shrink-0 rounded-md bg-[#edf7ef] px-2 py-1 text-[9px] font-semibold text-[#166534] sm:text-[10px]">
                    {{ badge }}
                </span>
            </slot>
        </header>

        <div v-if="normalizedItems.length" ref="chartAreaRef" class="relative mt-5 overflow-visible sm:mt-6">
            <div class="relative h-[235px] min-h-[235px] overflow-visible sm:h-[var(--chart-height)] sm:min-h-[220px]"
                :style="chartStyle">
                <div class="pointer-events-none absolute inset-x-0 top-0 bottom-7" aria-hidden="true">
                    <span v-for="line in gridLines" :key="line"
                        class="absolute inset-x-0 border-t border-dashed border-black/[0.06]"
                        :style="{ bottom: `${line}%` }" />
                </div>

                <div
                    class="absolute inset-0 grid grid-cols-[repeat(var(--chart-columns),minmax(0,1fr))] overflow-visible">
                    <div v-for="(item, index) in normalizedItems" :key="item.key"
                        class="grid min-w-0 grid-rows-[minmax(0,1fr)_28px] overflow-visible"
                        @pointerenter="handlePointerEnter(index, $event)" @pointerleave="handlePointerLeave(index)">
                        <div class="flex min-h-0 items-end justify-center overflow-visible">
                            <div class="relative flex h-full items-end justify-center overflow-visible">
                                <Transition enter-active-class="transition-all duration-150 ease-out"
                                    enter-from-class="translate-y-1 scale-95 opacity-0"
                                    enter-to-class="translate-y-0 scale-100 opacity-100"
                                    leave-active-class="transition-all duration-100 ease-in"
                                    leave-from-class="translate-y-0 scale-100 opacity-100"
                                    leave-to-class="translate-y-1 scale-95 opacity-0">
                                    <div v-if="isPopoverVisible(index)"
                                        class="absolute z-[100] whitespace-nowrap rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 shadow-[0_6px_18px_rgb(0_0_0/0.10)]"
                                        :style="{
                                            bottom: `${getBarHeight(item.value)}%`,
                                            marginBottom: '8px',
                                        }">
                                        <p class="text-[9px] font-medium text-[#8b8b93]">
                                            {{ item.fullLabel }}
                                        </p>

                                        <p class="mt-0.5 text-[11px] font-semibold text-[#166534]">
                                            {{ valueFormatter(item.value) }}
                                        </p>

                                        <span
                                            class="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-black/[0.06] bg-white" />
                                    </div>
                                </Transition>

                                <button type="button"
                                    class="w-[55%] min-w-9 max-w-8 origin-bottom cursor-pointer rounded-t-[4px] rounded-b-[2px] border-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:brightness-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534]/[0.18] sm:w-[42%] sm:min-w-[80px] sm:max-w-[42px] sm:rounded-t-[5px]"
                                    :class="[
                                        isBarActive(index)
                                            ? 'brightness-[1.04]'
                                            : '',
                                        animated
                                            ? 'scale-y-100'
                                            : 'scale-y-0',
                                    ]" :style="getBarStyle(item, index)"
                                    :aria-label="`${item.fullLabel}: ${valueFormatter(item.value)}`"
                                    :aria-pressed="isSelected(index)" @click="toggleSelected(index)" />
                            </div>
                        </div>

                        <span
                            class="overflow-hidden px-0.5 pt-2 text-center text-[9px] leading-5 font-medium text-ellipsis whitespace-nowrap text-[#8b8b93] sm:px-1 sm:text-[11px]">
                            {{ item.label }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="flex h-[220px] items-center justify-center text-xs text-[#8b8b93] sm:h-[260px]">
            Nenhum dado disponível.
        </div>
    </article>
</template>

<script setup>
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
} from 'vue'

const props = defineProps({
    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: '',
    },

    badge: {
        type: String,
        default: '',
    },

    items: {
        type: Array,
        required: true,
    },

    seriesName: {
        type: String,
        default: 'Valor',
    },

    height: {
        type: Number,
        default: 280,
    },

    valueFormatter: {
        type: Function,
        default: (value) => String(value),
    },
})

const gridLines = [0, 25, 50, 75, 100]

const chartAreaRef = ref(null)

const animated = ref(false)
const hoveredIndex = ref(null)
const selectedIndexes = ref([])

const normalizedItems = computed(() => {
    const items = props.items.slice(-7)
    const today = new Date()

    return items.map((item, index) => {
        const value = Number(item?.value)
        const daysAgo = items.length - 1 - index

        const date = new Date(today)

        date.setHours(0, 0, 0, 0)
        date.setDate(today.getDate() - daysAgo)

        return {
            ...item,

            key:
                item?.id ??
                item?.key ??
                `${date.getTime()}-${index}`,

            label: formatWeekday(date),

            fullLabel: formatFullDate(date),

            value: Number.isFinite(value)
                ? Math.max(0, value)
                : 0,
        }
    })
})

const highestValue = computed(() => {
    if (!normalizedItems.value.length) {
        return 0
    }

    return Math.max(
        ...normalizedItems.value.map((item) => item.value),
        0,
    )
})

const lowestValue = computed(() => {
    if (!normalizedItems.value.length) {
        return 0
    }

    return Math.min(
        ...normalizedItems.value.map((item) => item.value),
    )
})

const valueRange = computed(() => {
    return highestValue.value - lowestValue.value
})

const scaleMax = computed(() => {
    if (highestValue.value === 0) {
        return 1
    }

    return highestValue.value * 1.12
})

const minimumWidth = computed(() => {
    if (normalizedItems.value.length <= 7) {
        return '100%'
    }

    return `${normalizedItems.value.length * 64}px`
})

const chartStyle = computed(() => ({
    '--chart-height': `${props.height}px`,
    '--chart-columns': normalizedItems.value.length,
    minWidth: minimumWidth.value,
}))

const formatWeekday = (date) => {
    const value = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
    })
        .format(date)
        .replace('.', '')

    return value.charAt(0).toUpperCase() + value.slice(1)
}

const formatFullDate = (date) => {
    const value = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
    }).format(date)

    return value.charAt(0).toUpperCase() + value.slice(1)
}

const getBarHeight = (value) => {
    if (value <= 0) {
        return 0
    }

    return Math.min(
        (value / scaleMax.value) * 100,
        100,
    )
}

const getBarColor = (value) => {
    if (!normalizedItems.value.length) {
        return '#a8d56f'
    }

    if (valueRange.value === 0) {
        return '#4e9f3d'
    }

    const intensity = (value - lowestValue.value) / valueRange.value

    if (intensity <= 0.33) {
        return '#a8d56f'
    }

    if (intensity <= 0.66) {
        return '#4e9f3d'
    }

    return '#166534'
}

const getBarStyle = (item, index) => ({
    height: `${getBarHeight(item.value)}%`,
    transitionDelay: `${index * 70}ms`,
    backgroundColor: getBarColor(item.value),
})

const isSelected = (index) => {
    return selectedIndexes.value.includes(index)
}

const isPopoverVisible = (index) => {
    return (
        hoveredIndex.value === index ||
        selectedIndexes.value.includes(index)
    )
}

const isBarActive = (index) => {
    return isPopoverVisible(index)
}

const toggleSelected = (index) => {
    if (isSelected(index)) {
        selectedIndexes.value =
            selectedIndexes.value.filter(
                (selectedIndex) => selectedIndex !== index,
            )

        return
    }

    selectedIndexes.value = [
        ...selectedIndexes.value,
        index,
    ]
}

const handlePointerEnter = (index, event) => {
    if (event.pointerType !== 'mouse') {
        return
    }

    hoveredIndex.value = index
}

const handlePointerLeave = (index) => {
    if (hoveredIndex.value !== index) {
        return
    }

    hoveredIndex.value = null
}

const clearPopovers = () => {
    hoveredIndex.value = null
    selectedIndexes.value = []
}

const handleOutsidePointerDown = (event) => {
    if (!selectedIndexes.value.length) {
        return
    }

    if (chartAreaRef.value?.contains(event.target)) {
        return
    }

    clearPopovers()
}

const handleScroll = () => {
    if (
        hoveredIndex.value === null &&
        !selectedIndexes.value.length
    ) {
        return
    }

    clearPopovers()
}

onMounted(async () => {
    document.addEventListener(
        'pointerdown',
        handleOutsidePointerDown,
    )

    document.addEventListener(
        'scroll',
        handleScroll,
        {
            capture: true,
            passive: true,
        },
    )

    await nextTick()

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            animated.value = true
        })
    })
})

onBeforeUnmount(() => {
    document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
    )

    document.removeEventListener(
        'scroll',
        handleScroll,
        true,
    )
})
</script>