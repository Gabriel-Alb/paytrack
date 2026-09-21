<template>
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
        <button v-if="isOpen" type="button" aria-label="Fechar menu"
            class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden" @click="closeSidebar" />
    </Transition>

    <aside :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[280px] -translate-x-full flex-col border-r border-black/15 bg-white transition-transform duration-300 max-lg:pt-[env(safe-area-inset-top,0px)] max-lg:pb-[env(safe-area-inset-bottom,0px)] lg:z-40 lg:w-[224px] lg:translate-x-0',
        isOpen && 'translate-x-0',
    ]">
        <div
            class="flex h-[68px] shrink-0 items-center justify-between border-b border-black/12 px-5 lg:h-[60px] lg:px-5">
            <RouterLink to="/" class="flex items-center gap-3" @click="closeSidebar">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#166534]">
                    <img :src="logo" alt="PayTrack" class="h-7 w-7 object-contain" />
                </div>

                <div>
                    <p class="text-[17px] font-semibold tracking-[-0.01em] text-[#18181b]">
                        PayTrack
                    </p>

                    <p class="-mt-1 text-[10px] font-medium text-[#71717a]">
                        Gestão financeira
                    </p>
                </div>
            </RouterLink>

            <button type="button" aria-label="Fechar menu"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-[#f4f4f5] lg:hidden"
                @click="closeSidebar">
                <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                    <path :d="mdiClose" fill="currentColor" />
                </svg>
            </button>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4">
            <section v-for="(section, sectionIndex) in navigationSections" :key="section.title"
                :class="sectionIndex > 0 && 'mt-7'">
                <p class="mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-[#71717a] uppercase">
                    {{ section.title }}
                </p>

                <template v-for="item in section.items" :key="item.label">
                    <RouterLink v-if="item.to" :to="item.to" :class="getItemClasses(item)" @click="closeSidebar">
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

        <div ref="userMenuRef" class="relative p-3">
            <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="translate-y-1 opacity-0"
                enter-to-class="translate-y-0 opacity-100" leave-active-class="transition duration-100 ease-in"
                leave-from-class="translate-y-0 opacity-100" leave-to-class="translate-y-1 opacity-0">
                <div v-if="isUserMenuOpen"
                    class="absolute right-3 bottom-full left-3 -mb-3 overflow-hidden rounded-xl border border-black/20 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
                    <RouterLink to="/account"
                        class="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-[#52525b] transition-colors hover:bg-[#f7f7f8] hover:text-[#27272a]"
                        @click="handleMenuNavigation">
                        <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0 text-[#71717a]" aria-hidden="true">
                            <path :d="mdiAccountOutline" fill="currentColor" />
                        </svg>

                        <span>Minha conta</span>
                    </RouterLink>

                    <RouterLink v-if="canAdminister(user)" to="/users"
                        class="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-[#52525b] transition-colors hover:bg-[#f7f7f8] hover:text-[#27272a]"
                        @click="handleMenuNavigation">
                        <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0 text-[#71717a]" aria-hidden="true">
                            <path :d="mdiAccountKeyOutline" fill="currentColor" />
                        </svg>

                        <span>Administração</span>
                    </RouterLink>

                    <div class="my-1 border-t border-black/15" />

                    <button type="button" :disabled="pendingOperation"
                        class="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-[#dc2626] transition-colors hover:bg-[#fef2f2] disabled:pointer-events-none disabled:opacity-50"
                        @click="signOut">
                        <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                            <path :d="mdiLogout" fill="currentColor" />
                        </svg>

                        <span>Sair </span>
                    </button>
                </div>
            </Transition>

            <button type="button" :aria-expanded="isUserMenuOpen"
                class="flex w-full items-center gap-3 rounded-xl border border-black/5 px-2 py-2 text-left transition-colors hover:border-black/10 hover:bg-[#f7f7f8]"
                @click="toggleUserMenu">
                <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-xs font-semibold text-[#166534]">
                    {{ userInitial }}
                </div>

                <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-semibold text-[#27272a]">
                        {{ user?.name }}
                    </p>

                    <p class="truncate text-[11px] text-[#71717a]">
                        {{ user?.role === 'admin' ? 'Administrador' : canAdminister(user) ? 'Gerente de empresa' : 'Usuário padrão' }}
                    </p>
                </div>

                <svg viewBox="0 0 24 24"
                    class="h-[18px] w-[18px] shrink-0 text-[#71717a] transition-transform duration-200"
                    :class="isUserMenuOpen && 'rotate-180'" aria-hidden="true">
                    <path :d="mdiChevronUp" fill="currentColor" />
                </svg>
            </button>
        </div>
    </aside>
</template>

<script setup>
import { canAdminister } from '@/features/auth/companyAccess.js'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import {
    mdiAccountKeyOutline,
    mdiAccountOutline,
    mdiChevronUp,
    mdiClose,
    mdiLogout,
} from '@mdi/js'

import { useAuth } from '@/composables/useAuth'
import { perform, pendingOperation } from '@/services/api'

import { navigationSections } from './navigation'

import logo from '@/assets/img/logo.png'

defineProps({
    isOpen: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()

const { user, logout } = useAuth()

const userMenuRef = ref(null)
const isUserMenuOpen = ref(false)

const userInitial = computed(() => {
    return user.value?.name?.slice(0, 1).toUpperCase() ?? ''
})

const toggleUserMenu = () => {
    isUserMenuOpen.value = !isUserMenuOpen.value
}

const closeUserMenu = () => {
    isUserMenuOpen.value = false
}

const closeSidebar = () => {
    closeUserMenu()
    emit('close')
}

const handleMenuNavigation = () => {
    closeSidebar()
}

const handleClickOutside = (event) => {
    if (!userMenuRef.value?.contains(event.target)) {
        closeUserMenu()
    }
}

const signOut = () => {
    closeUserMenu()

    return perform(async () => {
        await logout()
        await router.replace('/login')
    })
}

const isActive = (item) => {
    return item.to === route.fullPath
}

const getItemClasses = (item) => [
    'mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition-colors',
    isActive(item)
        ? 'bg-[#edf7ef] font-semibold text-[#166534]'
        : 'font-medium text-[#71717a] hover:bg-[#f7f7f8] hover:text-[#3f3f46]',
]

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>
