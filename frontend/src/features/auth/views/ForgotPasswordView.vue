<template>
  <AuthShell wide split scrollable extend-mobile-background title="Recuperar senha"
    description="Informe o e-mail usado para entrar. Um administrador avaliará sua solicitação.">
    <p v-if="message" role="status" class="rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-900">{{ message }}</p>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="recovery-email" class="mb-1 block text-xs font-medium text-zinc-700">E-mail</label>
        <input id="recovery-email" v-model="email" type="email" autocomplete="username" required maxlength="254" :disabled="busy"
          class="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/10" />
      </div>
      <button :disabled="busy" class="h-10 w-full rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
        {{ busy ? 'Enviando…' : 'Solicitar recuperação' }}
      </button>
    </form>
    <p class="mt-4 text-xs leading-5 text-zinc-500">A recuperação é realizada pela administração da sua empresa. Entre em contato pelo procedimento interno para receber as orientações.</p>
    <RouterLink to="/login" class="mt-5 block text-center text-xs font-semibold text-[#166534]">Voltar para o login</RouterLink>
  </AuthShell>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AuthShell from '../components/AuthShell.vue'
import { passwordRecoveryApi } from '@/services/passwordRecovery.js'
import { toast } from '@/composables/useToast'

const email = ref(''), busy = ref(false), message = ref('')
async function submit() {
  if (busy.value) return
  busy.value = true
  try { message.value = (await passwordRecoveryApi.request(email.value)).message }
  catch (error) { toast.error(error.message) }
  finally { busy.value = false }
}
</script>
