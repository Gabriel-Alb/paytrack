<template>
  <AuthShell wide title="Solicitar acesso" description="Preencha seus dados. Um administrador avaliará sua solicitação antes de liberar o acesso.">
    <div v-if="sent" role="status" class="rounded-lg bg-green-50 p-4 text-sm leading-6 text-[#166534]">{{ sent }}</div>
    <form v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2" @submit.prevent="submit">
      <div v-for="field in fields" :key="field.key" :class="field.wide && 'sm:col-span-2'">
        <label :for="field.key" class="mb-2 block text-sm font-medium">{{ field.label }}</label>
        <input :id="field.key" v-model="form[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete || 'off'"
          :inputmode="field.inputmode" :required="field.required" :maxlength="field.max"
          class="h-12 w-full min-w-0 rounded-lg border border-black/15 px-3 text-base outline-none focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/15" />
      </div>
      <PasswordField id="new-password" v-model="form.password" hint="De 15 a 128 caracteres. Use uma frase longa e exclusiva." />
      <PasswordField id="confirm-password" v-model="confirmation" label="Confirmação da senha" />
      <p class="text-xs text-[#71717a] sm:col-span-2" aria-live="polite">{{ passwordHint }}</p>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{{ error }}</p>
      <button :disabled="busy" class="min-h-12 rounded-lg bg-[#166534] px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">{{ busy ? 'Enviando…' : 'Enviar solicitação' }}</button>
    </form>
    <p class="mt-6 text-center text-sm"><RouterLink to="/login" class="font-semibold text-[#166534] underline underline-offset-4">Voltar para o login</RouterLink></p>
  </AuthShell>
</template>
<script setup>
import { reactive,ref,computed,onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { request } from '@/services/api'
import AuthShell from '../components/AuthShell.vue'
import PasswordField from '../components/PasswordField.vue'
const form=reactive({name:'',email:'',cpf:'',rg:'',cnh:'',password:''})
const confirmation=ref(''),error=ref(''),busy=ref(false),sent=ref('')
const fields=[
  {key:'name',label:'Nome completo',required:true,max:150,autocomplete:'name',wide:true},
  {key:'email',label:'E-mail',type:'email',required:true,max:254,autocomplete:'username',wide:true},
  {key:'cpf',label:'CPF',required:true,max:30,inputmode:'numeric'},
  {key:'rg',label:'RG (opcional)',max:30},
  {key:'cnh',label:'CNH (opcional)',max:30,inputmode:'numeric',wide:true},
]
const passwordHint=computed(()=> {
  const length=[...form.password].length
  return !length ? 'Espaços, símbolos e caracteres Unicode são aceitos.' : length<15 ? 'A senha ainda está curta.' : length>128 ? 'Use no máximo 128 caracteres.' : 'Comprimento adequado. Evite frases comuns ou reutilizadas.'
})
async function submit() {
  if (busy.value) return
  error.value=''
  if (form.password!==confirmation.value) { error.value='As senhas não coincidem.'; return }
  if ([...form.password].length<15 || [...form.password].length>128) {error.value='A senha deve ter entre 15 e 128 caracteres.';return}
  busy.value=true
  try { sent.value=(await request('/auth/request-access',{method:'POST',body:{...form}})).message; for (const key of Object.keys(form)) form[key]='' }
  catch (failure) {error.value=failure.message || 'Não foi possível enviar. Tente novamente.'}
  finally {form.password='';confirmation.value='';busy.value=false}
}
onBeforeUnmount(()=>{form.password='';confirmation.value=''})
</script>
