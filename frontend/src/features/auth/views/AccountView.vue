```vue
<template>
  <section class="mx-auto w-full max-w-6xl">
    <div class="grid gap-4 lg:grid-cols-2">
      <section class="flex flex-col rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
        <header class="mb-5 flex items-start gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#166534]/[0.08] text-[#166534]">
            <i class="mdi mdi-account-outline text-[20px] leading-none"></i>
          </div>

          <div>
            <h2 class="text-[15px] font-semibold text-zinc-900">
              Dados pessoais
            </h2>

            <p class="mt-0.5 text-[12px] leading-5 text-zinc-500">
              Informações associadas ao seu cadastro.
            </p>
          </div>
        </header>

        <form class="flex flex-1 flex-col" @submit.prevent="saveProfile">
          <div class="space-y-4">
            <div v-for="(label, key) in profileLabels" :key="key">
              <label :for="`account-${key}`" class="mb-1.5 block text-[12px] font-medium text-zinc-600">
                {{ label }}
              </label>

              <input :id="`account-${key}`" :value="auth.user.value?.[key] || ''" readonly
                class="h-[46px] w-full cursor-default rounded-xl border border-black/[0.10] bg-[#fafafa] px-4 text-[13px] text-zinc-700 outline-none" />
            </div>

            <div>
              <label for="account-email" class="mb-1.5 block text-[12px] font-medium text-zinc-600">
                E-mail
              </label>

              <input id="account-email" v-model="email" type="email" autocomplete="email" required maxlength="254"
                :disabled="profileBusy"
                class="h-[46px] w-full rounded-xl border border-black/[0.10] bg-white px-4 text-[13px] text-zinc-900 outline-none transition duration-200 hover:border-black/[0.16] focus:border-[#166534]/60 focus:ring-3 focus:ring-[#166534]/[0.06] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-zinc-500" />
            </div>
          </div>

          <div class="mt-auto pt-5">
            <button :disabled="profileBusy"
              class="flex h-10 w-full items-center justify-center rounded-lg bg-[#166534] px-5 text-[13px] font-semibold text-white transition duration-200 hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {{ profileBusy ? 'Salvando…' : 'Salvar alterações' }}
            </button>
          </div>
        </form>
      </section>

      <section class="flex flex-col rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
        <header class="mb-5 flex items-start gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#166534]/[0.08] text-[#166534]">
            <i class="mdi mdi-lock-outline text-[20px] leading-none"></i>
          </div>

          <div>
            <h2 class="text-[15px] font-semibold text-zinc-900">
              Segurança
            </h2>

            <p class="mt-0.5 text-[12px] leading-5 text-zinc-500">
              Altere sua senha de acesso à plataforma.
            </p>
          </div>
        </header>

        <form class="flex flex-1 flex-col" @submit.prevent="submit">
          <div class="space-y-4">
            <PasswordField id="current-password" v-model="currentPassword" label="Senha atual"
              autocomplete="current-password" />

            <PasswordField id="new-password" v-model="newPassword" label="Nova senha"
              hint="Use de 6 a 20 caracteres." />

            <PasswordField id="confirmation" v-model="confirmation" label="Confirmação da nova senha" />
          </div>

          <div class="mt-auto pt-5">
            <button :disabled="busy"
              class="flex h-10 w-full items-center justify-center rounded-lg bg-[#166534] px-5 text-[13px] font-semibold text-white transition duration-200 hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {{ busy ? 'Alterando…' : 'Alterar senha' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<script setup>
import { toast } from '@/composables/useToast'
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import PasswordField from '../components/PasswordField.vue'
import {
  validPassword,
  PASSWORD_MESSAGE,
} from '../../../../../shared/password.js'

const auth = useAuth()
const router = useRouter()

const profileLabels = {
  name: 'Nome',
  cpf: 'CPF',
  rg: 'RG',
}

const email = ref(auth.user.value?.email || '')
const profileBusy = ref(false)


async function saveProfile() {
  if (profileBusy.value) return

  profileBusy.value = true

  try {
    await auth.updateProfile({ email: email.value })
    email.value = auth.user.value.email
    toast.success('Dados atualizados com sucesso.')
  } catch (failure) {
    toast.error(failure.message)
  } finally {
    profileBusy.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')

const busy = ref(false)

const clear = () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmation.value = ''
}

async function submit() {
  if (busy.value) return

  if (newPassword.value !== confirmation.value) {
    toast.error('As senhas não coincidem.')
    return
  }

  if (!validPassword(newPassword.value)) {
    toast.error(PASSWORD_MESSAGE)
    return
  }

  busy.value = true

  try {
    await auth.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })

    toast.success('Senha alterada. Entre novamente.')
    await router.replace('/login')
  } catch (failure) {
    toast.error(failure.message)
  } finally {
    clear()
    busy.value = false
  }
}

onBeforeUnmount(clear)
</script>
```
