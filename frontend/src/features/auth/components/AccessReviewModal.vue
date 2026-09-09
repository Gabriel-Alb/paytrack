<template>
  <BaseModal :model-value="!!userId" title="Avaliar acesso" @close="$emit('close')">
    <p v-if="loading" role="status">Carregando solicitação…</p>
    <p v-if="error" role="alert" class="text-sm text-red-800">{{ error }}</p>
    <dl v-if="person" class="space-y-4 text-sm">
      <div v-for="(label,key) in labels" :key="key"><dt class="text-[#71717a]">{{ label }}</dt><dd class="mt-1 break-words font-medium">{{ person[key] || 'Não informado' }}</dd></div>
    </dl>
    <template #footer>
      <button v-for="action in actions" :key="action.value" :disabled="busy || loading" class="min-h-11 rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-50" :class="action.value==='approve' && 'bg-[#166534] text-white'" @click="decide(action.value)">{{ busy ? 'Salvando…' : action.label }}</button>
    </template>
  </BaseModal>
</template>
<script setup>
import { ref,watch,computed } from 'vue'
import { request } from '@/services/api'
import BaseModal from '@/components/base/BaseModal.vue'
const props=defineProps({userId:{type:Number,default:null}})
const emit=defineEmits(['close','updated'])
const person=ref(null),loading=ref(false),busy=ref(false),error=ref('')
const labels={name:'Nome',email:'E-mail',cpf:'CPF',rg:'RG',cnh:'CNH',createdAt:'Data da solicitação'}
const actions=computed(()=>({pending:[{value:'reject',label:'Rejeitar'},{value:'approve',label:'Autorizar acesso'}],active:[{value:'block',label:'Bloquear acesso'}],blocked:[{value:'unblock',label:'Desbloquear acesso'}]}[person.value?.accessStatus] || []))
watch(()=>props.userId,async (id,_,onCleanup)=>{
  person.value=null;error.value=''
  if (!id) return
  let current=true
  const controller=new AbortController()
  onCleanup(()=>{current=false;controller.abort()})
  loading.value=true
  try {const result=await request(`/users/${id}`,{signal:controller.signal});if(current)person.value=result}
  catch (failure) {if(current)error.value=failure.message}
  finally {if(current)loading.value=false}
})
async function decide(action) {
  if(busy.value)return
  busy.value=true;error.value=''
  try {await request(`/users/${props.userId}/access`,{method:'PATCH',body:{action}});emit('updated');emit('close')}
  catch(failure){error.value=failure.message}
  finally{busy.value=false}
}
</script>
