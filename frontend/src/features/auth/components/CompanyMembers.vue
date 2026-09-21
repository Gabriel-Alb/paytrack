<template>
  <div class="mt-2 rounded-lg bg-zinc-50 p-3">
    <p v-if="loading" role="status" class="text-sm text-zinc-500">Carregando usuários…</p>
    <p v-else-if="!members.length" class="text-sm text-zinc-500">Nenhum usuário vinculado.</p>
    <ul v-else class="divide-y divide-black/10">
      <li v-for="member in members" :key="member.id" class="flex flex-wrap items-center justify-between gap-2 py-3">
        <div class="min-w-0"><p class="break-words text-sm font-medium">{{ member.name }}</p><p class="break-all text-xs text-zinc-500">{{ member.email }}</p>
          <p class="mt-1 text-xs text-zinc-600">{{ member.companyRole === 'MANAGER' ? 'Gerente' : 'Usuário' }} · {{ member.accessStatus === 'blocked' ? 'Bloqueado' : 'Ativo' }}</p>
        </div>
        <button class="min-h-11 rounded-lg px-3 text-xs font-semibold text-green-800 hover:bg-green-50" @click="edit(member)">Editar nível</button>
      </li>
    </ul>
    <div v-if="total > 50" class="flex items-center justify-between gap-2 text-xs">
      <button :disabled="page === 1 || loading" class="min-h-11 disabled:opacity-50" @click="page--">Anterior</button>
      <span>Página {{ page }}</span><button :disabled="page * 50 >= total || loading" class="min-h-11 disabled:opacity-50" @click="page++">Próxima</button>
    </div>
    <BaseModal :model-value="!!selected" title="Nível de acesso na empresa" @close="close">
      <p class="text-sm font-semibold">{{ selected?.name }}</p><p class="mt-1 break-words text-sm text-zinc-500">{{ company.name }}</p>
      <label :for="`member-role-${company.id}`" class="mt-4 block text-sm">Nível de acesso</label>
      <select :id="`member-role-${company.id}`" v-model="role" :disabled="busy" class="mt-2 min-h-11 w-full rounded-lg border border-black/15 px-3"><option value="USER">Usuário</option><option value="MANAGER">Gerente</option></select>
      <p v-if="removing" class="mt-4 text-sm text-red-700">Confirmar a remoção do vínculo com esta empresa?</p>
      <template #footer>
        <button :disabled="busy" class="min-h-11 rounded-lg px-3 text-xs text-red-700 disabled:opacity-50" @click="removing ? save(true) : removing = true">{{ removing ? 'Confirmar remoção' : 'Remover vínculo' }}</button>
        <button :disabled="busy" class="min-h-11 rounded-lg px-3 text-sm disabled:opacity-50" @click="close">Cancelar</button>
        <button :disabled="busy || removing" class="min-h-11 rounded-lg bg-green-800 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="save(false)">{{ busy ? 'Salvando…' : 'Salvar' }}</button>
      </template>
    </BaseModal>
  </div>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { request } from '@/services/api'
import { restoreAuth } from '@/composables/useAuth'
import { canManageCompany } from '../companyAccess.js'
import { toast } from '@/composables/useToast'
import BaseModal from '@/components/base/BaseModal.vue'
const props = defineProps({ company: { type: Object, required: true }, revision: { type: Number, default: 0 } })
const emit = defineEmits(['updated'])
const members = ref([]), total = ref(0), page = ref(1), loading = ref(false)
const selected = ref(null), role = ref('USER'), busy = ref(false), removing = ref(false)
let sequence = 0
async function load() {
  const current = ++sequence; loading.value = true
  try {
    const result = await request(`/companies/${props.company.id}/users?page=${page.value}`)
    if (sequence === current) {
      members.value = result.items; total.value = result.total
      if (page.value > 1 && !result.items.length) page.value = Math.max(1, Math.ceil(result.total / 50))
    }
  } catch (error) { if (sequence === current) { members.value = []; total.value = 0; toast.error(error.message) } }
  finally { if (sequence === current) loading.value = false }
}
function edit(member) { selected.value = member; role.value = member.companyRole; removing.value = false }
function close() { if (!busy.value) { selected.value = null; removing.value = false } }
async function save(remove) {
  if (busy.value || !selected.value) return
  busy.value = true
  try {
    await request(`/companies/${props.company.id}/users/${selected.value.id}`, { method: remove ? 'DELETE' : 'PATCH', ...(remove ? {} : { body: { role: role.value } }) })
    selected.value = null; toast.success('Vínculo atualizado.')
    const current = await restoreAuth()
    if (!canManageCompany(current, props.company.id)) { members.value = []; total.value = 0 }
    emit('updated')
  } catch (error) { toast.error(error.message) }
  finally { busy.value = false }
}
watch([page, () => props.revision], load, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>
