<template>
  <AuthShell wide split extend-mobile-background title="Entrar" description="Entre com seu e-mail e senha para acessar sua conta.">
    <p v-if="route.query.passwordChanged" role="status"
      class="mb-4 rounded-lg border border-[#166534]/10 bg-[#166534]/[0.06] px-3.5 py-2.5 text-xs text-[#166534] lg:text-sm">
      Senha alterada. Entre novamente.
    </p>

    <form class="space-y-3" @submit.prevent="submit">
      <div>
        <label for="email" class="mb-1 block text-xs font-medium text-[#3f3f46]">
          E-mail
        </label>

        <input id="email" v-model="email" type="email" autocomplete="username" required maxlength="254"
          class="h-10 w-full min-w-0 rounded-lg border border-black/[0.10] bg-[#fafafa] px-3.5 text-[13px] text-[#18181b] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-black/[0.16] focus:border-[#166534]/70 focus:bg-white focus:ring-4 focus:ring-[#166534]/[0.07]" />
      </div>

      <PasswordField id="password" v-model="password" autocomplete="current-password"
        class="[&_input]:h-10 [&_input]:rounded-lg [&_input]:text-[13px] [&_label]:mb-1 [&_label]:text-xs" />

      <p v-if="error || apiError" role="alert"
        class="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-xs text-red-700">
        {{ error || apiError }}
      </p>

      <button :disabled="busy"
        class="mt-0.5 flex h-10 w-full items-center justify-center rounded-lg bg-[#166534] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(22,101,52,0.14)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#14532d] hover:shadow-[0_8px_20px_rgba(22,101,52,0.18)] active:translate-y-0 active:scale-[0.995] disabled:pointer-events-none disabled:opacity-50">
        {{ busy ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <div class="mt-5 flex items-center gap-3">
      <div class="h-px flex-1 bg-black/[0.07]" />

      <span class="text-[10px] text-black/30">
        PayTrack
      </span>

      <div class="h-px flex-1 bg-black/[0.07]" />
    </div>

    <p class="mt-4 text-center text-xs text-[#71717a]">
      Não possui acesso?

      <RouterLink to="/request-access"
        class="ml-1 font-semibold text-[#166534] transition-colors duration-200 hover:text-[#14532d]">
        Solicite acesso
      </RouterLink>
    </p>
  </AuthShell>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { apiError } from '@/services/api'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (busy.value) return

  busy.value = true
  error.value = ''
  apiError.value = ''

  try {
    await auth.login({
      email: email.value,
      password: password.value,
    })

    await router.replace('/')
  } catch (failure) {
    error.value =
      failure.message || 'Não foi possível conectar. Tente novamente.'
  } finally {
    password.value = ''
    busy.value = false
  }
}

onBeforeUnmount(() => {
  password.value = ''
})
</script>
