<template>
    <header
        class="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-black/[0.06] bg-white/95 px-4 backdrop-blur-sm sm:px-7 lg:h-[76px] lg:px-10"
    >
        <div class="flex min-w-0 items-center gap-3">
            <button
                type="button"
                aria-label="Abrir menu"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#52525b] transition-colors hover:bg-[#f4f4f5] lg:hidden"
                @click="$emit('open-sidebar')"
            >
                <svg
                    viewBox="0 0 24 24"
                    class="h-[22px] w-[22px]"
                    aria-hidden="true"
                >
                    <path
                        :d="mdiMenu"
                        fill="currentColor"
                    />
                </svg>
            </button>

            <div class="min-w-0">
                <h1
                    class="truncate text-[21px] font-semibold tracking-[-0.03em] text-[#18181b] sm:text-[23px]"
                >
                    {{ pageTitle }}
                </h1>
            </div>
        </div>

        <button
            type="button"
            aria-label="Abrir notificações"
            aria-controls="notifications-sidebar"
            :aria-expanded="isNotificationsOpen"
            class="relative flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#52525b] transition-colors hover:bg-[#f4f4f5]"
            @click="$emit('open-notifications')"
        >
            <svg
                viewBox="0 0 24 24"
                class="h-[20px] w-[20px]"
                aria-hidden="true"
            >
                <path
                    :d="mdiBellOutline"
                    fill="currentColor"
                />
            </svg>

            <span
                class="absolute top-[7px] right-[7px] h-2 w-2 rounded-full border-2 border-white bg-[#b91c1c]"
            />
        </button>
    </header>
</template>

<script setup>
import {
    mdiBellOutline,
    mdiMenu,
} from '@mdi/js'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineProps({
    isNotificationsOpen: {
        type: Boolean,
        default: false,
    },
})

defineEmits([
    'open-sidebar',
    'open-notifications',
])

const route = useRoute()

const pageTitle = computed(() => {
    return route.meta.title || 'Dashboard'
})
</script>