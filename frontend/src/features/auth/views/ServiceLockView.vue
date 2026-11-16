<template>
  <main class="lock-page grid min-h-dvh place-items-center px-4 py-8 text-[#213c31]">
    <section v-if="user?.serviceLock" aria-labelledby="lock-title"
      class="w-full max-w-[540px] overflow-hidden rounded-3xl border border-[#d4e2d8] bg-white shadow-[0_18px_60px_-22px_rgba(36,70,50,0.24)]">
      <header class="lock-header relative isolate flex h-[104px] items-center justify-between gap-4 overflow-hidden border-b border-[#dce8df] px-6 sm:h-[120px] sm:px-10">
        <div class="flex items-center gap-2.5">
          <span class="grid size-10 place-items-center rounded-xl bg-[#306348]">
            <img :src="logo" alt="" class="h-7 w-7 object-contain" />
          </span>
          <span class="text-xl font-semibold tracking-[-0.045em]">PayTrack</span>
        </div>
        <span class="lock-icon grid size-12 shrink-0 place-items-center rounded-full border border-[#bed4c5] bg-[#f2f8f3] text-[#37674d]" aria-hidden="true">
          <span class="mdi mdi-lock-outline text-2xl" />
        </span>
      </header>

      <div class="px-6 pt-7 pb-6 sm:px-10 sm:pt-9 sm:pb-8">
        <h1 id="lock-title" ref="heading" tabindex="-1"
          class="text-balance text-[26px] leading-[1.16] font-semibold tracking-[-0.04em] outline-none sm:text-[32px]">
          {{ user.serviceLock.title }}
        </h1>
        <div class="mt-5 space-y-3.5 text-[15px] leading-6 text-[#4b6055] sm:leading-[1.65]">
          <p v-for="paragraph in user.serviceLock.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </div>
        <footer class="mt-7 border-t border-[#e3ebe5] pt-5 sm:mt-8">
          <button type="button" :disabled="busy" @click="logout"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#c6d8cb] bg-[#f5f9f6] px-4 text-sm font-semibold text-[#335e45] hover:bg-[#eaf2ec] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#37674d] disabled:opacity-60">
            <span class="mdi mdi-logout text-lg" aria-hidden="true" />
            {{ busy ? 'Saindo…' : 'Sair da conta' }}
          </button>
          <p v-if="error" role="alert" class="mt-3 text-sm">{{ error }}</p>
        </footer>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { toast } from '@/composables/useToast'
import logo from '@/assets/img/logo.png'

const auth = useAuth()
const { user } = auth
const router = useRouter()
const heading = ref(null)
const busy = ref(false)
const error = ref('')

onMounted(() => {
  toast.clear()
  heading.value?.focus()
})

async function logout() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.logout()
    await router.replace({ name: 'login' })
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.lock-page {
  background: radial-gradient(ellipse at 15% 10%, #f4f8f3, transparent 65%),
    linear-gradient(135deg, #e6efe7, #dce9df);
}
.lock-header {
  background: linear-gradient(110deg, #f4f8f3, #e3eee5);
}
.lock-icon {
  box-shadow: 0 0 0 12px #ffffff42, 0 0 0 13px #c6d9cb80,
    0 0 0 30px #ffffff24, 0 0 0 31px #c6d9cb70,
    0 0 0 52px #ffffff18, 0 0 0 53px #c6d9cb60;
}
</style>
