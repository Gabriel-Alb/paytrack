<template>
  <section class="max-w-xl rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7">
    <h2 class="text-lg font-semibold">Alterar senha</h2>
    <p class="mt-2 mb-6 text-sm text-[#71717a]">{{ auth.user.value?.email }} · Após a alteração, todas as sessões serão encerradas.</p>
    <form class="space-y-5" @submit.prevent="submit">
      <PasswordField id="current-password" v-model="currentPassword" label="Senha atual" autocomplete="current-password" />
      <PasswordField id="new-password" v-model="newPassword" label="Nova senha" hint="Use de 6 a 20 caracteres." />
      <PasswordField id="confirmation" v-model="confirmation" label="Confirmação da nova senha" />
      <p v-if="error" role="alert" class="text-sm text-red-800">{{ error }}</p>
      <button :disabled="busy" class="min-h-12 w-full rounded-lg bg-[#166534] px-4 py-3 font-semibold text-white disabled:opacity-50">{{ busy ? 'Alterando…' : 'Alterar senha' }}</button>
    </form>
  </section>
</template>
<script setup>
import { ref,onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import PasswordField from '../components/PasswordField.vue'
import { validPassword, PASSWORD_MESSAGE } from '../../../../../shared/password.js'
const auth=useAuth(),router=useRouter()
const currentPassword=ref(''),newPassword=ref(''),confirmation=ref(''),error=ref(''),busy=ref(false)
const clear=()=>{currentPassword.value='';newPassword.value='';confirmation.value=''}
async function submit() {
  if (busy.value) return
  error.value=''
  if (newPassword.value!==confirmation.value) {error.value='As senhas não coincidem.';return}
  if (!validPassword(newPassword.value)) {error.value=PASSWORD_MESSAGE;return}
  busy.value=true
  try {await auth.changePassword({currentPassword:currentPassword.value,newPassword:newPassword.value});await router.replace('/login?passwordChanged=1')}
  catch (failure) {error.value=failure.message}
  finally {clear();busy.value=false}
}
onBeforeUnmount(clear)
</script>
