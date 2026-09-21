<template>
  <section class="mt-5 space-y-3 border-t border-black/10 pt-4">
    <h3 class="text-sm font-semibold">Solicitação por empresa</h3>
    <div v-for="company in rows" :key="company.id" class="space-y-2 rounded-lg border border-black/10 p-3 text-sm">
      <p class="break-words font-medium">{{ company.name }}</p>
      <p v-if="company.status !== 'pending'" class="text-xs text-zinc-500">
        {{ company.status === 'approved' ? 'Aprovado' : 'Recusado' }}
        <span v-if="company.companyRole"> · {{ company.companyRole === 'MANAGER' ? 'Gerente' : 'Usuário' }}</span>
      </p>
      <template v-else>
        <div>
          <label :for="`decision-${userId}-${company.id}`" class="block text-xs">Decisão</label>
          <select :id="`decision-${userId}-${company.id}`" v-model="choices[company.id].action" :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border border-black/15 px-3">
            <option value="">Manter pendente</option><option value="approve">Aprovar</option><option value="reject">Recusar</option>
          </select>
        </div>
        <div v-if="choices[company.id].action === 'approve'">
          <label :for="`decision-role-${userId}-${company.id}`" class="block text-xs">Nível na empresa</label>
          <select :id="`decision-role-${userId}-${company.id}`" v-model="choices[company.id].role" :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border border-black/15 px-3">
            <option value="USER">Usuário</option><option value="MANAGER">Gerente</option>
          </select>
        </div>
      </template>
    </div>
    <div v-if="rows.some(row => row.status === 'pending')" class="flex flex-wrap gap-2">
      <button type="button" :disabled="busy" class="min-h-11 rounded-lg border border-black/15 px-3 text-xs disabled:opacity-50" @click="rejectRemaining">Recusar demais pendentes</button>
      <button type="button" :disabled="busy || !decisions.length" class="min-h-11 rounded-lg bg-green-800 px-3 text-xs font-semibold text-white disabled:opacity-50" @click="save">{{ busy ? 'Salvando…' : 'Salvar decisões' }}</button>
    </div>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { request } from '@/services/api'
import { toast } from '@/composables/useToast'
import { companyDecisions } from '../companyAccess.js'
const props = defineProps({ userId: { type: Number, required: true }, rows: { type: Array, required: true } })
const emit = defineEmits(['updated', 'refresh'])
const choices = ref({}), busy = ref(false)
watch(() => props.rows, rows => { choices.value = Object.fromEntries(rows.map(row => [row.id, { action: '', role: 'USER' }])) }, { immediate: true })
const decisions = computed(() => companyDecisions(props.rows, choices.value))
function rejectRemaining() {
  for (const row of props.rows) if (row.status === 'pending' && !choices.value[row.id].action) choices.value[row.id].action = 'reject'
}
async function save() {
  if (busy.value || !decisions.value.length) return
  busy.value = true
  try {
    await request(`/users/${props.userId}/company-access`, { method: 'PATCH', body: { decisions: decisions.value } })
    toast.success('Decisões salvas.'); emit('updated')
  } catch (error) { toast.error(error.message); if (error.status === 409) emit('refresh') }
  finally { busy.value = false }
}
</script>
