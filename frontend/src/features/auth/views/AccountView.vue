<template>
  <section class="max-w-xl rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7">
    <h2 class="text-lg font-semibold">Meus dados</h2>
    <form class="mt-2 mb-6 space-y-5" @submit.prevent="saveProfile">
      <div v-for="(label,key) in profileLabels" :key="key">
        <label :for="`account-${key}`" class="mb-2 block text-sm font-medium text-[#3f3f46]">{{ label }}</label>
        <input :id="`account-${key}`" :value="auth.user.value?.[key] || ''" readonly class="h-10 w-full rounded-xl border border-black/[0.10] bg-[#fafafa] px-3.5 text-[13px] text-[#18181b] outline-none lg:h-[46px] lg:px-4 lg:text-sm" />
      </div>
      <div>
        <label for="account-email" class="mb-2 block text-sm font-medium text-[#3f3f46]">E-mail</label>
        <input id="account-email" v-model="email" type="email" autocomplete="email" required maxlength="254" :disabled="profileBusy" class="h-10 w-full rounded-xl border border-black/[0.10] bg-[#fafafa] px-3.5 text-[13px] text-[#18181b] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-black/[0.16] focus:border-[#166534]/70 focus:bg-white focus:ring-4 focus:ring-[#166534]/[0.07] lg:h-[46px] lg:px-4 lg:text-sm" />
      </div>
      <p v-if="profileError" role="alert" class="text-sm text-red-800">{{ profileError }}</p>
      <p v-if="profileMessage" role="status" class="text-sm text-[#166534]">{{ profileMessage }}</p>
      <button :disabled="profileBusy" class="min-h-12 w-full rounded-lg bg-[#166534] px-4 py-3 font-semibold text-white disabled:opacity-50">{{ profileBusy ? 'Salvando…' : 'Salvar dados' }}</button>
    </form>
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
const profileLabels={name:'Nome',cpf:'CPF',rg:'RG'}
const email=ref(auth.user.value?.email || ''),profileBusy=ref(false),profileError=ref(''),profileMessage=ref('')
async function saveProfile() {
  if (profileBusy.value) return
  profileBusy.value=true;profileError.value='';profileMessage.value=''
  try {
    await auth.updateProfile({email:email.value})
    email.value=auth.user.value.email
    profileMessage.value='Dados atualizados com sucesso.'
  } catch (failure) {profileError.value=failure.message}
  finally {profileBusy.value=false}
}
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
