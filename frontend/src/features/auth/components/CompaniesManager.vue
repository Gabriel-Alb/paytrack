<template>
  <section class="mt-6 rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-lg font-semibold">Empresas</h2>
      <button class="min-h-11 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white" @click="open = true">Nova empresa</button>
    </div>
    <ul class="mt-4 divide-y divide-black/5"><li v-for="company in companies" :key="company.id" class="py-3 text-sm">{{ company.name }}</li></ul>
    <BaseModal :model-value="open" title="Nova empresa" @close="open = false">
      <form id="company-form" @submit.prevent="save">
        <label class="block text-sm">Nome da empresa<input v-model.trim="name" required minlength="2" maxlength="150" class="mt-2 h-11 w-full rounded-lg border border-black/15 px-3" /></label>
      </form>
      <template #footer><button :disabled="busy" form="company-form" type="submit" class="min-h-11 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white disabled:opacity-50">{{ busy ? 'Salvando…' : 'Cadastrar empresa' }}</button></template>
    </BaseModal>
  </section>
</template>
<script setup>
import { toast } from '@/composables/useToast'
import { ref } from 'vue'
import { request } from '@/services/api'
import BaseModal from '@/components/base/BaseModal.vue'
const companies = ref([]), open = ref(false), name = ref(''), busy = ref(false)
async function load() {
  try { companies.value = await request('/companies'); }
  catch (failure) { toast.error(failure.message) }
}
async function save() {
  if (busy.value) return
  busy.value = true
  try { await request('/companies',{method:'POST',body:{name:name.value}}); open.value = false; name.value = ''; toast.success('Empresa cadastrada com sucesso.'); await load() }
  catch (failure) { toast.error(failure.message) }
  finally { busy.value = false }
}
load()
</script>
