<template>
  <BaseModal :model-value="!!userId" title="Avaliar acesso" @close="$emit('close')">
    <p v-if="loading" role="status">Carregando solicitação…</p>
    <dl v-if="person" class="space-y-4 text-sm">
      <div v-for="(label,key) in labels" :key="key"><dt class="text-[#71717a]">{{ label }}</dt><dd class="mt-1 break-words font-medium">{{ person[key] || 'Não informado' }}</dd></div>
      <div v-if="['pending','active','blocked'].includes(person.accessStatus)">
        <dt><label for="access-role" class="text-[#71717a]">Nível de acesso</label></dt>
        <dd class="mt-1"><select id="access-role" v-model="role" :disabled="busy" class="min-h-11 rounded-lg border border-black/15 px-3"><option value="user">Usuário padrão</option><option value="admin">Administrador</option></select></dd>
      </div>
      <div v-if="['pending','active','blocked'].includes(person.accessStatus)">
        <dt class="text-[#71717a]">Empresas permitidas</dt>
        <dd v-if="role === 'admin'" class="mt-2">Acesso global a todas as empresas.</dd>
        <dd v-else class="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-black/15 p-3">
          <label v-for="company in companies" :key="company.id" class="flex min-h-9 items-center gap-2"><input v-model="companyIds" type="checkbox" :value="company.id" :disabled="busy" />{{ company.name }}</label>
        </dd>
      </div>
    </dl>
    <template #footer>
      <button v-for="action in actions" :key="action.value" :disabled="busy || loading" class="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-50" :class="action.value==='approve' && 'bg-[#166534] text-white'" @click="decide(action.value)">{{ busy ? 'Salvando…' : action.label }}</button>
    </template>
  </BaseModal>
</template>
<script setup>
import { toast } from '@/composables/useToast'
import { ref,watch,computed } from 'vue'
import { request } from '@/services/api'
import BaseModal from '@/components/base/BaseModal.vue'
const props=defineProps({userId:{type:Number,default:null}})
const emit=defineEmits(['close','updated'])
const person=ref(null),loading=ref(false),busy=ref(false)
const role=ref('user'),companyIds=ref([]),companies=ref([])
const labels={name:'Nome',email:'E-mail',cpf:'CPF',rg:'RG',cnh:'CNH',createdAt:'Data da solicitação'}
const actions=computed(()=>({pending:[{value:'reject',label:'Rejeitar'},{value:'approve',label:'Autorizar acesso'}],active:[{value:'edit',label:'Salvar permissões'},{value:'block',label:'Bloquear acesso'}],blocked:[{value:'edit',label:'Salvar permissões'},{value:'unblock',label:'Desbloquear acesso'}]}[person.value?.accessStatus] || []))
watch(()=>props.userId,async (id,_,onCleanup)=>{
  person.value=null;role.value='user';companyIds.value=[]
  if (!id) return
  let current=true
  const controller=new AbortController()
  onCleanup(()=>{current=false;controller.abort()})
  loading.value=true
  try {const [result,available]=await Promise.all([request(`/users/${id}`,{signal:controller.signal}),request('/companies',{signal:controller.signal})]);if(current){person.value=result;companies.value=available;role.value=result.accessStatus==='pending' ? 'user' : result.role;companyIds.value=result.companyIds}}
  catch (failure) {if(current)toast.error(failure.message)}
  finally {if(current)loading.value=false}
})
async function decide(action) {
  if(busy.value || loading.value || !person.value)return
  if (['approve','edit'].includes(action) && role.value === 'user' && !companyIds.value.length) { toast.warning('Selecione pelo menos uma empresa.'); return }
  busy.value=true
  try {await request(`/users/${props.userId}/access`,{method:'PATCH',body:['approve','edit'].includes(action) ? {action,role:role.value,companyIds:companyIds.value} : {action}});toast.success('Acesso atualizado com sucesso.');emit('updated');emit('close')}
  catch(failure){toast.error(failure.message)}
  finally{busy.value=false}
}
</script>
