<template>
    <Teleport to="body">
        <Transition name="notifications-backdrop">
            <div v-if="isOpen" class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" aria-hidden="true"
                @click="close" />
        </Transition>

        <Transition name="notifications-sidebar">
            <aside v-if="isOpen" id="notifications-sidebar"
                class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-black/[0.06] bg-[#f7f7f8] shadow-[-12px_0_30px_rgba(0,0,0,0.06)] sm:w-[392px]"
                role="dialog" aria-modal="true" aria-labelledby="notifications-title">
                <NotificationSidebarHeader ref="headerRef" @close="close" />

                <NotificationFilters v-model="activeFilter" :filters="filters" />

                <div class="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                    <template v-if="groupedNotifications.length">
                        <NotificationGroup v-for="group in groupedNotifications" :key="group.label" :label="group.label"
                            :notifications="group.notifications" />
                    </template>

                    <NotificationEmptyState v-else />
                </div>
            </aside>
        </Transition>
    </Teleport>
</template>

<script setup>
import {
    nextTick,
    onBeforeUnmount,
    ref,
    watch,
} from 'vue'

import NotificationEmptyState from './notifications/NotificationEmptyState.vue'
import NotificationFilters from './notifications/NotificationFilters.vue'
import NotificationGroup from './notifications/NotificationGroup.vue'
import NotificationSidebarHeader from './notifications/NotificationSidebarHeader.vue'

import { notifications } from '../../mocks/notificationMock.js'
import { useNotifications } from '../../composables/useNotifications.js'

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['close'])

const headerRef = ref(null)

const {
    activeFilter,
    filters,
    groupedNotifications,
} = useNotifications(notifications)

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

    headerRef.value?.focusCloseButton()
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