<template>
  <AuthShell
    wide
    split
    scrollable
    title="Solicitar acesso"
    description="Preencha seus dados. Um administrador avaliará sua solicitação antes de liberar o acesso."
  >
    <form
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
          class="h-10 w-full min-w-0 rounded-lg border border-black/[0.12] bg-[#fafafa] px-3.5 text-[13px] text-[#18181b] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-black/[0.16] focus:border-[#166534]/70 focus:bg-white focus:ring-4 focus:ring-[#166534]/[0.07]"
        />
      </div>

      <PasswordField
        id="new-password"
        v-model="form.password"
        hint="De 6 a 20 caracteres. Use uma senha exclusiva."
        class="[&_input]:h-10 [&_input]:rounded-lg [&_input]:text-[13px] [&_label]:mb-1 [&_label]:text-xs [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-4"
      />

      <PasswordField
        id="confirm-password"
        v-model="confirmation"
        label="Confirmação da senha"
        class="[&_input]:h-10 [&_input]:rounded-lg [&_input]:text-[13px] [&_label]:mb-1 [&_label]:text-xs"
      />

      <fieldset class="lg:col-span-2" :disabled="busy || companiesLoading">
        <legend class="mb-1 text-xs font-medium text-[#3f3f46]">Empresas desejadas</legend>
        <p class="mb-2 text-xs text-zinc-500">Selecione uma ou mais empresas. Cada acesso será avaliado separadamente.</p>
        <p v-if="companiesLoading" role="status" class="text-sm text-zinc-500">Carregando empresas…</p>
        <div v-else-if="companies.length" class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-black/15 p-2">
          <label v-for="company in companies" :key="company.id" class="flex min-h-10 items-center gap-2 px-1 text-sm">
            <input v-model="companyIds" type="checkbox" :value="company.id" class="accent-green-800" />
            <span class="break-words">{{ company.name }}</span>
          </label>
        </div>
        <p v-else class="text-sm text-zinc-500">Nenhuma empresa disponível.</p>
      </fieldset>
      <button v-if="companiesError" type="button" class="min-h-11 text-sm font-semibold text-green-800 lg:col-span-2" @click="loadCompanies">Tentar carregar empresas novamente</button>

      <button
        :disabled="busy || companiesLoading || !companies.length"
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
import { RouterLink, useRouter } from 'vue-router'
import { toast } from '@/composables/useToast'
import { request } from '@/services/api'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'
import { validPassword, PASSWORD_MESSAGE } from '../../../../../shared/password.js'

const form = reactive({
  name: '',
  email: '',
  cpf: '',
  rg: '',
  cnh: '',
  password: '',
})

const companies = ref([]), companyIds = ref([])
const companiesLoading = ref(false), companiesError = ref(false)
async function loadCompanies() {
  companiesLoading.value = true; companiesError.value = false
  try { companies.value = await request('/auth/companies') }
  catch (error) { companiesError.value = true; toast.error(error.message) }
  finally { companiesLoading.value = false }
}
loadCompanies()
const confirmation = ref('')
const busy = ref(false)
const router = useRouter()

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
  if (!companyIds.value.length) { toast.warning('Selecione pelo menos uma empresa.'); return }

  if (form.password !== confirmation.value) {
    toast.error('As senhas não coincidem.')
    return
  }

  if (!validPassword(form.password)) {
    toast.error(PASSWORD_MESSAGE)
    return
  }

  busy.value = true

  try {
    await request('/auth/request-access', {
        method: 'POST',
        body: {
          ...form,
          companyIds: companyIds.value,
        },
      })

    toast.success('Acesso solicitado com sucesso. Aguarde a avaliação do administrador.')

    for (const key of Object.keys(form)) {
      form[key] = ''
    }
    confirmation.value = ''
    await router.replace('/login')
  } catch (failure) {
    toast.error(failure.message || 'Não foi possível enviar. Tente novamente.')
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  form.password = ''
  confirmation.value = ''
})
</script>
