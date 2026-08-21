<template>
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
        <button v-if="isOpen" type="button" aria-label="Fechar menu"
            class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden" @click="$emit('close')" />
    </Transition>

    <aside :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[280px] -translate-x-full flex-col border-r border-black/[0.07] bg-white transition-transform duration-300 lg:z-40 lg:w-[248px] lg:translate-x-0',
        isOpen && 'translate-x-0',
    ]">
        <div
            class="flex h-[68px] shrink-0 items-center justify-between border-b border-black/[0.05] px-5 lg:h-[76px] lg:px-6">
            <RouterLink to="/" class="flex items-center gap-3" @click="$emit('close')">
                <div
                    class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#166534] text-sm font-bold text-white">
                    P
                </div>

                <div>
                    <p class="text-[17px] font-semibold tracking-[-0.02em] text-[#18181b]">
                        PayTrack
                    </p>

                    <p class="mt-0.5 text-[10px] font-medium text-[#a1a1aa]">
                        Gestão financeira
                    </p>
                </div>
            </RouterLink>

            <button type="button" aria-label="Fechar menu"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-[#f4f4f5] lg:hidden"
                @click="$emit('close')">
                <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                    <path :d="mdiClose" fill="currentColor" />
                </svg>
            </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4">
            <section v-for="(section, sectionIndex) in navigationSections" :key="section.title"
                :class="sectionIndex > 0 && 'mt-7'">
                <p class="mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-[#a1a1aa] uppercase">
                    {{ section.title }}
                </p>

                <template v-for="item in section.items" :key="item.label">
                    <RouterLink v-if="item.to" :to="item.to" :class="getItemClasses(item)" @click="$emit('close')">
                        <svg viewBox="0 0 24 24" class="h-[19px] w-[19px] shrink-0" aria-hidden="true">
                            <path :d="item.icon" fill="currentColor" />
                        </svg>

                        <span>{{ item.label }}</span>
                    </RouterLink>

                    <button v-else type="button" :class="getItemClasses(item)">
                        <svg viewBox="0 0 24 24" class="h-[19px] w-[19px] shrink-0" aria-hidden="true">
                            <path :d="item.icon" fill="currentColor" />
                        </svg>

                        <span>{{ item.label }}</span>
                    </button>
                </template>
            </section>
        </nav>

        <div class="border-t border-black/[0.06] p-4">
            <div class="flex items-center gap-3 px-2 py-2">
                <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0fdf4] text-xs font-semibold text-[#166534]">
                    GA
                </div>

                <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-semibold text-[#27272a]">
                        Gabriel
                    </p>

                    <p class="truncate text-[11px] text-[#a1a1aa]">
                        Administrador
                    </p>
                </div>
            </div>
        </div>
    </aside>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router'

import {
    mdiClose,
    mdiLogout,
} from '@mdi/js'

import { navigationSections } from './navigation'

defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
})

defineEmits(['close'])

const route = useRoute()

const isActive = (item) => {
    return item.to === route.path
}

const getItemClasses = (item) => [
    'mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition-colors',
    isActive(item)
        ? 'bg-[#edf7ef] font-semibold text-[#166534]'
        : 'font-medium text-[#71717a] hover:bg-[#f7f7f8] hover:text-[#3f3f46]',
]
</script>