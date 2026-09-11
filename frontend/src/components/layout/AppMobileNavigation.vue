<template>
    <!-- Continue the navigation background through the home-indicator area. -->
    <div
        aria-hidden="true"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-xl lg:hidden"
    />
    <nav
        aria-label="Navegação principal"
        class="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 z-30 grid grid-cols-4 rounded-md border border-black/[0.07] bg-white/95 p-1.5 backdrop-blur-xl lg:hidden"
    >
        <template
            v-for="item in mobileNavigationItems"
            :key="item.label"
        >
            <RouterLink
                v-if="item.to"
                :to="item.to"
                :class="getItemClasses(item)"
            >
                <svg
                    viewBox="0 0 24 24"
                    class="h-5 w-5"
                    aria-hidden="true"
                >
                    <path
                        :d="item.icon"
                        fill="currentColor"
                    />
                </svg>

                <span class="text-[9px] font-semibold">
                    {{ item.label }}
                </span>
            </RouterLink>

            <button
                v-else
                type="button"
                :class="getItemClasses(item)"
            >
                <svg
                    viewBox="0 0 24 24"
                    class="h-5 w-5"
                    aria-hidden="true"
                >
                    <path
                        :d="item.icon"
                        fill="currentColor"
                    />
                </svg>

                <span class="text-[9px] font-medium">
                    {{ item.label }}
                </span>
            </button>
        </template>
    </nav>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router'

import { mobileNavigationItems } from './navigation'

const route = useRoute()

const isActive = (item) => {
    return item.to === route.path
}

const getItemClasses = (item) => [
    'flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-lg transition-colors',
    isActive(item)
        ? 'bg-[#edf7ef] text-[#166534]'
        : 'text-[#8b8b93] hover:bg-[#f7f7f8]',
]
</script>
