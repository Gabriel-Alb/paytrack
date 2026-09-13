<template>
  <section class="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-4"><h2 class="text-lg font-semibold">Usuários e solicitações</h2>
      <div><label for="status" class="mr-3 text-sm">Status</label><select id="status" v-model="status" class="min-h-11 rounded-lg border border-black/15 px-3"><option value="pending">Pendentes</option><option value="active">Ativos</option><option value="rejected">Rejeitados</option><option value="blocked">Bloqueados</option></select></div></div>
    <p v-if="feedback" role="status" class="mt-4 text-sm text-[#166534]">{{ feedback }}</p>
    <p v-if="error" role="alert" class="mt-4 text-sm text-red-800">{{ error }}</p>
    <p v-if="loading" class="mt-5" role="status">Carregando…</p>
    <ul v-else class="mt-5 divide-y divide-black/5"><li v-for="person in items" :key="person.id" class="flex flex-wrap items-center justify-between gap-3 py-4"><div class="min-w-0"><p class="break-words font-medium">{{ person.name }}</p><p class="break-all text-sm text-[#71717a]">{{ person.email }}</p><p class="mt-1 text-xs text-[#71717a]">{{ person.role === 'admin' ? 'Administrador' : 'Usuário padrão' }}</p></div><button class="min-h-11 rounded-lg border border-black/15 px-4 text-sm font-semibold text-[#166534]" @click="selected=person.id">Ver acesso</button></li></ul>
    <p v-if="!loading && !items.length" class="py-6 text-sm text-[#71717a]">Nenhum usuário neste status.</p>
    <div v-if="total>50" class="mt-4 flex items-center gap-3"><button :disabled="page===1" @click="page--">Anterior</button><span>{{ page }}</span><button :disabled="page*50>=total" @click="page++">Próxima</button></div>
    <AccessReviewModal :user-id="selected" @close="selected=null" @updated="updated" />
  </section>
  <CompaniesManager />
</template>
<script setup>
import { ref,watch,onMounted,onBeforeUnmount } from 'vue'
import { request,watchAccessChanges } from '@/services/api'
import CompaniesManager from '../components/CompaniesManager.vue'
import AccessReviewModal from '../components/AccessReviewModal.vue'
const status=ref('pending'),items=ref([]),total=ref(0),page=ref(1),selected=ref(null),loading=ref(false),error=ref(''),feedback=ref('')
let sequence=0
async function load(background=false) {
  const id=++sequence
  if (!background) loading.value=true
  error.value=''
  try {const result=await request(`/users?status=${status.value}&page=${page.value}`);if(id===sequence){items.value=result.items;total.value=result.total}}
  catch(failure){if(id===sequence)error.value=failure.message}
  finally{if(id===sequence)loading.value=false}
}
function updated(){feedback.value='Acesso atualizado com sucesso.';load()}
watch(status,()=>{page.value=1;load()})
watch(page,()=>load())
let stopWatching
onMounted(()=>{stopWatching=watchAccessChanges(()=>load(true))})
onBeforeUnmount(()=>{sequence++;stopWatching?.()})
load()
</script>
