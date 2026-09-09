<template>
  <AuthShell title="Bem-vindo ao PayTrack" description="Entre com seu e-mail e senha para continuar.">
    <p v-if="route.query.passwordChanged" role="status" class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-[#166534]">Senha alterada. Entre novamente.</p>
    <form class="space-y-5" @submit.prevent="submit">
      <div><label for="email" class="mb-2 block text-sm font-medium">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="username" required maxlength="254" class="h-12 w-full rounded-lg border border-black/15 px-3 text-base outline-none focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/15" /></div>
      <PasswordField id="password" v-model="password" autocomplete="current-password" />
      <p v-if="error || apiError" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-800">{{ error || apiError }}</p>
      <button :disabled="busy" class="h-12 w-full rounded-lg bg-[#166534] font-semibold text-white hover:bg-[#14532d] disabled:opacity-50">{{ busy ? 'Entrando…' : 'Entrar' }}</button>
    </form>
    <p class="mt-6 text-center text-sm text-[#71717a]">Ainda não tem acesso? <RouterLink to="/request-access" class="font-semibold text-[#166534] underline underline-offset-4">Solicitar acesso</RouterLink></p>
  </AuthShell>
</template>
<script setup>
import { ref,onBeforeUnmount } from 'vue'
import { useRouter,useRoute,RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { apiError } from '@/services/api'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'
const router=useRouter(), route=useRoute(), auth=useAuth()
const email=ref(''),password=ref(''),error=ref(''),busy=ref(false)
async function submit() {
  if (busy.value) return
  busy.value=true; error.value=''; apiError.value=''
  try { await auth.login({email:email.value,password:password.value}); await router.replace('/') }
  catch (failure) { error.value=failure.message || 'Não foi possível conectar. Tente novamente.' }
  finally { password.value=''; busy.value=false }
}
onBeforeUnmount(()=>{password.value=''})
</script>
