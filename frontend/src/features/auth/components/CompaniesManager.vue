<template>
  <section class="mt-6 rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-lg font-semibold">Empresas</h2>
      <button class="min-h-11 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white" @click="openForm()">Nova empresa</button>
    </div>
    <ul class="mt-4 divide-y divide-black/5">
      <li v-for="company in companies" :key="company.id" class="flex items-center justify-between gap-3 py-3 text-sm">
        <span class="min-w-0 [overflow-wrap:anywhere]">{{ company.name }}</span>
        <button type="button" :aria-label="`Editar empresa ${company.name}`"
          class="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-[#166534] transition-colors hover:bg-[#edf7ef] focus-visible:outline-2 focus-visible:outline-[#166534]"
          @click="openForm(company)">Editar</button>
      </li>
    </ul>
    <BaseModal :model-value="open" :title="editingId ? 'Editar empresa' : 'Nova empresa'" @close="closeForm">
      <form id="company-form" @submit.prevent="save">
        <label class="block text-sm">Nome da empresa<input v-model.trim="name" required minlength="2" maxlength="150" class="mt-2 h-11 w-full rounded-lg border border-black/15 px-3" /></label>
      </form>
      <template #footer>
        <button type="button" :disabled="busy" class="min-h-11 rounded-lg px-4 text-sm font-semibold text-[#52525b] hover:bg-black/[0.04] disabled:opacity-50" @click="closeForm">Cancelar</button>
        <button :disabled="busy" form="company-form" type="submit" class="min-h-11 rounded-lg bg-[#166534] px-4 text-sm font-semibold text-white disabled:opacity-50">{{ busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar empresa' }}</button>
      </template>
    </BaseModal>
  </section>
</template>
<script setup>
import { toast } from '@/composables/useToast'
import { ref } from 'vue'
import { request } from '@/services/api'
import BaseModal from '@/components/base/BaseModal.vue'
const companies = ref([]), open = ref(false), name = ref(''), busy = ref(false)
const editingId = ref(null)
function openForm(company) {
  editingId.value = company?.id ?? null
  name.value = company?.name ?? ''
  open.value = true
}
function closeForm() {
  if (!busy.value) open.value = false
}
async function load() {
  try { companies.value = await request('/companies'); }
  catch (failure) { toast.error(failure.message) }
}
async function save() {
  if (busy.value) return
  busy.value = true
  try {
    const id = editingId.value
    const company = await request(id ? `/companies/${id}` : '/companies', { method: id ? 'PATCH' : 'POST', body: { name: name.value } })
    companies.value = [...companies.value.filter(item => item.id !== company.id), company]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    open.value = false
    name.value = ''
    toast.success(id ? 'Empresa atualizada com sucesso.' : 'Empresa cadastrada com sucesso.')
  }
  catch (failure) { toast.error(failure.message) }
  finally { busy.value = false }
}
load()
</script>
