<template>
    <section class="px-3 pt-4 sm:px-4">
        <h3 class="mb-2 px-1 text-[10px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase">
            {{ label }}
        </h3>

        <div class="space-y-2">
            <NotificationCard v-for="notification in notifications" :key="notification.id"
                :notification="notification" />
        </div>
    </section>
</template>

<script setup>
import NotificationCard from './NotificationCard.vue'

defineProps({
    label: {
        type: String,
        required: true,
    },
    notifications: {
        type: Array,
        required: true,
    },
})
</script>