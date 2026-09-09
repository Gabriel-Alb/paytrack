<template>
  <AuthShell
    wide
    split
    mobile-scrollable
    title="Solicitar acesso"
    description="Preencha seus dados. Um administrador avaliará sua solicitação antes de liberar o acesso."
  >
    <div
      v-if="sent"
      role="status"
      class="rounded-xl border border-[#166534]/10 bg-[#166534]/[0.06] px-4 py-3 text-sm leading-6 text-[#166534]"
    >
      {{ sent }}
    </div>

    <form
      v-else
      class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-2.5"
      @submit.prevent="submit"
    >
      <div
        v-for="field in fields"
        :key="field.key"
        :class="field.wide && 'lg:col-span-2'"
      >
        <label
          :for="field.key"
          class="mb-1 block text-xs font-medium text-[#3f3f46]"
        >
          {{ field.label }}
        </label>

        <input
          :id="field.key"
          v-model="form[field.key]"
          :type="field.type || 'text'"
          :autocomplete="field.autocomplete || 'off'"
          :inputmode="field.inputmode"
          :required="field.required"
          :maxlength="field.max"
          class="h-10 w-full min-w-0 rounded-lg border border-black/[0.10] bg-[#fafafa] px-3.5 text-[13px] text-[#18181b] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-black/[0.16] focus:border-[#166534]/70 focus:bg-white focus:ring-4 focus:ring-[#166534]/[0.07]"
        />
      </div>

      <PasswordField
        id="new-password"
        v-model="form.password"
        hint="De 15 a 128 caracteres. Use uma frase longa e exclusiva."
        class="[&_input]:h-10 [&_input]:rounded-lg [&_input]:text-[13px] [&_label]:mb-1 [&_label]:text-xs [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-4"
      />

      <PasswordField
        id="confirm-password"
        v-model="confirmation"
        label="Confirmação da senha"
        class="[&_input]:h-10 [&_input]:rounded-lg [&_input]:text-[13px] [&_label]:mb-1 [&_label]:text-xs"
      />

      <p
        v-if="error"
        role="alert"
        class="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-xs text-red-700 lg:col-span-2"
      >
        {{ error }}
      </p>

      <button
        :disabled="busy"
        class="mt-0.5 flex h-10 items-center justify-center rounded-lg bg-[#166534] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(22,101,52,0.14)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#14532d] hover:shadow-[0_8px_20px_rgba(22,101,52,0.18)] active:translate-y-0 active:scale-[0.995] disabled:pointer-events-none disabled:opacity-50 lg:col-span-2"
      >
        {{ busy ? 'Enviando…' : 'Enviar solicitação' }}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[#71717a]">
      Já possui acesso?

      <RouterLink
        to="/login"
        class="ml-1 font-semibold text-[#166534] transition-colors duration-200 hover:text-[#14532d]"
      >
        Voltar para o login
      </RouterLink>
    </p>
  </AuthShell>
</template>

<script setup>
import { onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { request } from '@/services/api'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'

const form = reactive({
  name: '',
  email: '',
  cpf: '',
  rg: '',
  cnh: '',
  password: '',
})

const confirmation = ref('')
const error = ref('')
const busy = ref(false)
const sent = ref('')

const fields = [
  {
    key: 'name',
    label: 'Nome completo',
    required: true,
    max: 150,
    autocomplete: 'name',
    wide: true,
  },
  {
    key: 'email',
    label: 'E-mail',
    type: 'email',
    required: true,
    max: 254,
    autocomplete: 'username',
    wide: true,
  },
  {
    key: 'cpf',
    label: 'CPF',
    required: true,
    max: 30,
    inputmode: 'numeric',
  },
  {
    key: 'rg',
    label: 'RG (opcional)',
    max: 30,
  },
  {
    key: 'cnh',
    label: 'CNH (opcional)',
    max: 30,
    inputmode: 'numeric',
    wide: true,
  },
]

async function submit() {
  if (busy.value) return

  error.value = ''

  if (form.password !== confirmation.value) {
    error.value = 'As senhas não coincidem.'
    return
  }

  if ([...form.password].length < 15 || [...form.password].length > 128) {
    error.value = 'A senha deve ter entre 15 e 128 caracteres.'
    return
  }

  busy.value = true

  try {
    sent.value = (
      await request('/auth/request-access', {
        method: 'POST',
        body: {
          ...form,
        },
      })
    ).message

    for (const key of Object.keys(form)) {
      form[key] = ''
    }
  } catch (failure) {
    error.value =
      failure.message || 'Não foi possível enviar. Tente novamente.'
  } finally {
    form.password = ''
    confirmation.value = ''
    busy.value = false
  }
}

onBeforeUnmount(() => {
  form.password = ''
  confirmation.value = ''
})
</script>