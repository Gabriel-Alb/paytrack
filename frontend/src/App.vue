<template>
  <RouterView v-slot="{ Component }">
    <component :is="user?.serviceLock ? ServiceLockView : Component" />
  </RouterView>
  <ToastHost v-if="!user?.serviceLock" />
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import ToastHost from '@/components/base/ToastHost.vue'
import ServiceLockView from '@/features/auth/views/ServiceLockView.vue'
import { useAuth } from '@/composables/useAuth'

const { user, checkServiceStatus } = useAuth()
const route = useRoute()
const router = useRouter()
let timer
let checking = false

async function refreshAccess() {
  if (!user.value || document.hidden || checking) return
  checking = true
  try {
    const status = await checkServiceStatus()
    if (!status) return
    if (status.serviceLock && route.name !== 'service-lock') {
      await router.replace({ name: 'service-lock' })
    } else if (route.name === 'service-lock' && !status.serviceLock) {
      await router.replace({ name: 'dashboard' })
    }
  } catch {
    // A session expiry is handled centrally. Retry network failures on the next check.
  } finally {
    checking = false
  }
}

onMounted(() => {
  timer = setInterval(refreshAccess, 30000)
  document.addEventListener('visibilitychange', refreshAccess)
  window.addEventListener('focus', refreshAccess)
  window.addEventListener('pageshow', refreshAccess)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshAccess)
  window.removeEventListener('focus', refreshAccess)
  window.removeEventListener('pageshow', refreshAccess)
})
</script>
