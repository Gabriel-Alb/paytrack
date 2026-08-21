<template>
    <div class="min-h-screen bg-[#f6f7f8] text-[#18181b]">
        <AppSidebar
            :is-open="isSidebarOpen"
            @close="closeSidebar"
        />

        <div class="min-h-screen lg:pl-[248px]">
            <AppHeader @open-sidebar="openSidebar" />

            <main class="px-4 pt-5 pb-28 sm:px-7 sm:py-6 lg:px-10 lg:py-8">
                <RouterView />
            </main>
        </div>

        <AppMobileNavigation />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppMobileNavigation from '@/components/layout/AppMobileNavigation.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const isSidebarOpen = ref(false)

const openSidebar = () => {
    isSidebarOpen.value = true
}

const closeSidebar = () => {
    isSidebarOpen.value = false
}
</script>