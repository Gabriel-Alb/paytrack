<template>
    <div class="min-h-screen bg-[#f6f7f8] text-[#18181b]">
        <AppSidebar
            :is-open="isSidebarOpen"
            @close="closeSidebar"
        />

        <div class="min-h-screen lg:pl-[224px]">
            <AppHeader
                :is-notifications-open="isNotificationsOpen"
                @open-sidebar="openSidebar"
                @open-notifications="openNotifications"
            />

            <main :class="route.name === 'reports'
                ? 'px-3 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-5 lg:px-5 lg:py-4'
                : 'px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-7 sm:pt-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:px-10 lg:py-8'">
                <p v-if="apiError" role="alert" class="mb-4 text-sm text-red-700">{{ apiError }}</p>
                <p v-if="apiNotice" role="status" class="mb-4 text-sm text-[#166534]">{{ apiNotice }}</p>
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
import { apiError,apiNotice } from '@/services/api'
import { RouterView, useRoute } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppMobileNavigation from '@/components/layout/AppMobileNavigation.vue'
import AppNotificationsSidebar from '@/components/layout/AppNotificationsSidebar.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const isSidebarOpen = ref(false)
const route = useRoute()
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
