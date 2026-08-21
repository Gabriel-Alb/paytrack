<template>
    <div class="min-h-screen bg-[#f6f7f8] text-[#18181b]">
        <AppSidebar
            :is-open="isSidebarOpen"
            @close="closeSidebar"
        />

        <div class="min-h-screen lg:pl-[248px]">
            <AppHeader
                :is-notifications-open="isNotificationsOpen"
                @open-sidebar="openSidebar"
                @open-notifications="openNotifications"
            />

            <main class="px-4 pt-5 pb-28 sm:px-7 sm:py-6 lg:px-10 lg:py-8">
                <RouterView />
            </main>
        </div>

        <AppNotificationsSidebar
            :is-open="isNotificationsOpen"
            @close="closeNotifications"
        />

        <AppMobileNavigation />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppMobileNavigation from '@/components/layout/AppMobileNavigation.vue'
import AppNotificationsSidebar from '@/components/layout/AppNotificationsSidebar.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const isSidebarOpen = ref(false)
const isNotificationsOpen = ref(false)

const openSidebar = () => {
    isNotificationsOpen.value = false
    isSidebarOpen.value = true
}

const closeSidebar = () => {
    isSidebarOpen.value = false
}

const openNotifications = () => {
    isSidebarOpen.value = false
    isNotificationsOpen.value = true
}

const closeNotifications = () => {
    isNotificationsOpen.value = false
}
</script>