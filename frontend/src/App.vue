<template>
  <RouterView />
  <ToastHost />
</template>

<script setup>
import { RouterView } from 'vue-router'
import ToastHost from '@/components/base/ToastHost.vue'
</script>
