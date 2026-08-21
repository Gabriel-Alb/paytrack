<template>
    <Teleport to="body">
        <Transition name="notifications-backdrop">
            <div
                v-if="isOpen"
                class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                aria-hidden="true"
                @click="close"
            />
        </Transition>

        <Transition name="notifications-sidebar">
            <aside
                v-if="isOpen"
                id="notifications-sidebar"
                class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-black/[0.06] bg-[#f7f7f8] shadow-[-12px_0_30px_rgba(0,0,0,0.06)] sm:w-[392px]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="notifications-title"
            >
                <header
                    class="flex h-[60px] shrink-0 items-center justify-between border-b border-black/[0.06] bg-white px-4"
                >
                    <h2
                        id="notifications-title"
                        class="text-[17px] font-semibold tracking-[-0.02em] text-[#18181b]"
                    >
                        Notificações
                    </h2>

                    <button
                        ref="closeButton"
                        type="button"
                        aria-label="Fechar notificações"
                        class="flex h-8 w-8 items-center justify-center rounded-md text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#18181b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181b]"
                        @click="close"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            class="h-[19px] w-[19px]"
                            aria-hidden="true"
                        >
                            <path
                                :d="mdiClose"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </header>

                <nav
                    class="shrink-0 border-b border-black/[0.06] bg-white px-4"
                    aria-label="Filtrar notificações"
                >
                    <div
                        class="flex items-center gap-5"
                        role="tablist"
                    >
                        <button
                            v-for="filter in filters"
                            :key="filter.value"
                            type="button"
                            role="tab"
                            :aria-selected="activeFilter === filter.value"
                            :class="[
                                'relative py-3 text-[12px] font-medium transition-colors',
                                activeFilter === filter.value
                                    ? 'text-[#18181b]'
                                    : 'text-[#a1a1aa] hover:text-[#52525b]',
                            ]"
                            @click="activeFilter = filter.value"
                        >
                            {{ filter.label }}

                            <span
                                v-if="activeFilter === filter.value"
                                class="absolute right-0 bottom-0 left-0 h-[2px] rounded-full bg-[#18181b]"
                            />
                        </button>
                    </div>
                </nav>

                <div
                    class="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]"
                >
                    <template v-if="groupedNotifications.length">
                        <section
                            v-for="group in groupedNotifications"
                            :key="group.label"
                            class="px-3 pt-4 sm:px-4"
                        >
                            <h3
                                class="mb-2 px-1 text-[10px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase"
                            >
                                {{ group.label }}
                            </h3>

                            <div class="space-y-2">
                                <article
                                    v-for="notification in group.notifications"
                                    :key="notification.id"
                                    class="rounded-[14px] border border-black/[0.07] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.025)] transition-[border-color,box-shadow,transform] duration-200 sm:hover:-translate-y-px sm:hover:border-black/[0.11] sm:hover:shadow-[0_5px_14px_rgba(0,0,0,0.05)]"
                                >
                                    <div class="flex items-start gap-2.5">
                                        <div
                                            :class="[
                                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                                notification.type === 'payment'
                                                    ? 'bg-[#edf7f0] text-[#15803d]'
                                                    : 'bg-[#fdf0f0] text-[#b91c1c]',
                                            ]"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                class="h-[18px] w-[18px]"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    :d="
                                                        notification.type === 'payment'
                                                            ? mdiCheckCircleOutline
                                                            : mdiAlertCircleOutline
                                                    "
                                                    fill="currentColor"
                                                />
                                            </svg>
                                        </div>

                                        <div class="min-w-0 flex-1">
                                            <div
                                                class="flex items-center justify-between gap-3"
                                            >
                                                <h4
                                                    class="truncate text-[13px] font-semibold leading-5 text-[#27272a]"
                                                >
                                                    {{
                                                        notification.type === 'payment'
                                                            ? 'Pagamento efetuado'
                                                            : 'Parcela em atraso'
                                                    }}
                                                </h4>

                                                <time
                                                    :datetime="notification.datetime"
                                                    class="shrink-0 text-[10px] font-medium text-[#a1a1aa]"
                                                >
                                                    {{
                                                        formatNotificationTime(
                                                            notification.datetime,
                                                        )
                                                    }}
                                                </time>
                                            </div>

                                            <p
                                                class="mt-0.5 truncate text-[12px] leading-5 text-[#71717a]"
                                            >
                                                {{
                                                    notification.type === 'payment'
                                                        ? 'Pagador:'
                                                        : 'Cliente:'
                                                }}

                                                <strong
                                                    class="font-medium text-[#3f3f46]"
                                                >
                                                    {{ notification.customer }}
                                                </strong>
                                            </p>

                                            <div
                                                class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-[#71717a]"
                                            >
                                                <strong
                                                    class="font-semibold text-[#3f3f46]"
                                                >
                                                    {{ notification.amount }}
                                                </strong>

                                                <span
                                                    class="text-[#d4d4d8]"
                                                    aria-hidden="true"
                                                >
                                                    •
                                                </span>

                                                <span>
                                                    Parcela
                                                    <strong
                                                        class="font-semibold text-[#3f3f46]"
                                                    >
                                                        {{ notification.installment }}
                                                    </strong>
                                                </span>

                                                <template
                                                    v-if="notification.type === 'overdue'"
                                                >
                                                    <span
                                                        class="text-[#d4d4d8]"
                                                        aria-hidden="true"
                                                    >
                                                        •
                                                    </span>

                                                    <strong
                                                        class="font-semibold text-[#b91c1c]"
                                                    >
                                                        {{ notification.overdueDays }}
                                                    </strong>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        </section>
                    </template>

                    <div
                        v-else
                        class="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center"
                    >
                        <div
                            class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#a1a1aa] shadow-sm"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                class="h-5 w-5"
                                aria-hidden="true"
                            >
                                <path
                                    :d="mdiBellOutline"
                                    fill="currentColor"
                                />
                            </svg>
                        </div>

                        <h3 class="mt-3 text-[13px] font-semibold text-[#3f3f46]">
                            Nenhuma notificação
                        </h3>

                        <p class="mt-1 text-[12px] text-[#a1a1aa]">
                            Não existem alertas para este filtro.
                        </p>
                    </div>
                </div>
            </aside>
        </Transition>
    </Teleport>
</template>

<script setup>
import {
    mdiAlertCircleOutline,
    mdiBellOutline,
    mdiCheckCircleOutline,
    mdiClose,
} from '@mdi/js'
import {
    computed,
    nextTick,
    onBeforeUnmount,
    ref,
    watch,
} from 'vue'

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['close'])

const closeButton = ref(null)
const activeFilter = ref('all')

const filters = [
    {
        label: 'Todas',
        value: 'all',
    },
    {
        label: 'Pagamentos',
        value: 'payment',
    },
    {
        label: 'Atrasos',
        value: 'overdue',
    },
]

const notifications = [
    {
        id: 1,
        type: 'payment',
        customer: 'Mariana Costa',
        amount: 'R$ 250,00',
        installment: '1/5',
        datetime: '2026-08-20T22:15:00-03:00',
    },
    {
        id: 2,
        type: 'overdue',
        customer: 'João Mendes',
        amount: 'R$ 180,00',
        installment: '2/8',
        overdueDays: '3 dias de atraso',
        datetime: '2026-08-20T18:40:00-03:00',
    },
    {
        id: 3,
        type: 'payment',
        customer: 'Ana Souza',
        amount: 'R$ 120,00',
        installment: '4/10',
        datetime: '2026-08-20T14:25:00-03:00',
    },
    {
        id: 4,
        type: 'overdue',
        customer: 'Carlos Augusto',
        amount: 'R$ 300,00',
        installment: '6/12',
        overdueDays: '5 dias de atraso',
        datetime: '2026-08-19T09:10:00-03:00',
    },
    {
        id: 5,
        type: 'payment',
        customer: 'Lucas Almeida',
        amount: 'R$ 200,00',
        installment: '3/6',
        datetime: '2026-08-19T08:30:00-03:00',
    },
    {
        id: 6,
        type: 'payment',
        customer: 'Fernanda Lima',
        amount: 'R$ 150,00',
        installment: '8/10',
        datetime: '2026-08-18T16:45:00-03:00',
    },
    {
        id: 7,
        type: 'overdue',
        customer: 'Rafael Martins',
        amount: 'R$ 275,00',
        installment: '1/4',
        overdueDays: '2 dias de atraso',
        datetime: '2026-08-18T11:20:00-03:00',
    },
]

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
})

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
})

const filteredNotifications = computed(() => {
    if (activeFilter.value === 'all') {
        return notifications
    }

    return notifications.filter(
        (notification) => notification.type === activeFilter.value,
    )
})

const formatNotificationGroup = (value) => {
    const notificationDate = new Date(value)
    const today = new Date()
    const yesterday = new Date(today)

    yesterday.setDate(today.getDate() - 1)

    const notificationKey = dateKeyFormatter.format(notificationDate)
    const todayKey = dateKeyFormatter.format(today)
    const yesterdayKey = dateKeyFormatter.format(yesterday)

    if (notificationKey === todayKey) {
        return 'Hoje'
    }

    if (notificationKey === yesterdayKey) {
        return 'Ontem'
    }

    return fullDateFormatter.format(notificationDate)
}

const formatNotificationTime = (value) => {
    return timeFormatter.format(new Date(value))
}

const groupedNotifications = computed(() => {
    const groups = []

    filteredNotifications.value.forEach((notification) => {
        const label = formatNotificationGroup(notification.datetime)
        const group = groups.find((item) => item.label === label)

        if (group) {
            group.notifications.push(notification)
            return
        }

        groups.push({
            label,
            notifications: [notification],
        })
    })

    return groups
})

let previousFocusedElement = null
let previousBodyOverflow = ''

const close = () => {
    emit('close')
}

const handleKeydown = (event) => {
    if (event.key === 'Escape') {
        close()
    }
}

const enableSidebar = async () => {
    previousFocusedElement = document.activeElement
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)

    await nextTick()
    closeButton.value?.focus()
}

const disableSidebar = () => {
    document.body.style.overflow = previousBodyOverflow
    document.removeEventListener('keydown', handleKeydown)
    previousFocusedElement?.focus?.()
}

watch(
    () => props.isOpen,
    (isOpen) => {
        if (isOpen) {
            enableSidebar()
            return
        }

        disableSidebar()
    },
)

onBeforeUnmount(() => {
    if (props.isOpen) {
        document.body.style.overflow = previousBodyOverflow
    }

    document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.notifications-backdrop-enter-active,
.notifications-backdrop-leave-active {
    transition: opacity 180ms ease;
}

.notifications-backdrop-enter-from,
.notifications-backdrop-leave-to {
    opacity: 0;
}

.notifications-sidebar-enter-active,
.notifications-sidebar-leave-active {
    transition: transform 240ms ease;
}

.notifications-sidebar-enter-from,
.notifications-sidebar-leave-to {
    transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
    .notifications-backdrop-enter-active,
    .notifications-backdrop-leave-active,
    .notifications-sidebar-enter-active,
    .notifications-sidebar-leave-active {
        transition-duration: 1ms;
    }
}
</style>