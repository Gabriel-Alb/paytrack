<template>
  <AuthShell wide split scrollable extend-mobile-background title="Criar nova senha"
    description="Você entrou com uma senha temporária. Crie sua nova senha para acessar o PayTrack.">
    <form class="space-y-4" @submit.prevent="submit">
      <PasswordField id="required-password" v-model="password" label="Nova senha" hint="Use de 6 a 20 caracteres, diferentes da senha temporária." />
      <PasswordField id="required-confirmation" v-model="confirmation" label="Confirmar nova senha" />
      <button :disabled="busy" class="h-10 w-full rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
        {{ busy ? 'Salvando…' : 'Salvar nova senha' }}
      </button>
      <button type="button" :disabled="busy" class="w-full text-xs font-semibold text-[#166534] disabled:opacity-50" @click="logout">Sair</button>
    </form>
  </AuthShell>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { toast } from '@/composables/useToast'
import { validPassword, PASSWORD_MESSAGE } from '../../../../../shared/password.js'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'

const auth = useAuth(), router = useRouter()
const password = ref(''), confirmation = ref(''), busy = ref(false)
const clear = () => { password.value = ''; confirmation.value = '' }
async function submit() {
  if (busy.value) return
  if (password.value !== confirmation.value) return toast.error('As senhas não coincidem.')
  if (!validPassword(password.value)) return toast.error(PASSWORD_MESSAGE)
  busy.value = true
  try {
    await auth.changeRequiredPassword({newPassword:password.value})
    toast.success('Senha alterada com sucesso.')
    await router.replace('/')
  } catch (error) { toast.error(error.message) }
  finally { clear(); busy.value = false }
}
async function logout() {
  if (busy.value) return
  busy.value = true
  try { await auth.logout(); await router.replace('/login') }
  catch (error) { toast.error(error.message) }
  finally { clear(); busy.value = false }
}
onBeforeUnmount(clear)
</script>
