<template>
    <div class="min-h-screen bg-[#f6f7f8] text-[#18181b]">
        <AppSidebar />

        <div class="min-h-screen lg:pl-[248px]">
            <AppHeader />

            <main class="px-5 py-6 sm:px-7 lg:px-10 lg:py-8">
                <RouterView />
            </main>
        </div>
    </div>
</template>

<script setup>
import { RouterView } from 'vue-router'

import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
</script>