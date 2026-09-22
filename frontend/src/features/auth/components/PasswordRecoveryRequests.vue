<template>
  <section id="password-recovery" class="overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] p-5 sm:px-6">
      <div>
        <h2 class="text-[15px] font-semibold text-zinc-900">Recuperação de senha</h2>
        <p class="mt-1 text-xs text-zinc-500">Confirme a identidade pelo procedimento interno antes de aprovar.</p>
      </div>
      <div class="flex items-center gap-2">
        <label for="recovery-status" class="text-xs text-zinc-500">Status</label>
        <select id="recovery-status" v-model="status" class="h-9 rounded-lg border border-zinc-200 px-3 text-xs">
          <option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option>
        </select>
        <button type="button" :disabled="loading" class="text-xs font-semibold text-green-800 disabled:opacity-50" @click="load">Atualizar</button>
      </div>
    </header>
    <p v-if="loading" role="status" class="p-6 text-sm text-zinc-500">Carregando solicitações…</p>
    <p v-else-if="!items.length" class="p-6 text-sm text-zinc-500">Nenhuma solicitação neste status.</p>
    <ul v-else class="divide-y divide-black/[0.07]">
      <li v-for="item in items" :key="item.id" class="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center sm:px-6">
        <div class="min-w-0">
          <p class="break-words text-sm font-semibold text-zinc-900">{{ item.name }}</p>
          <p class="break-all text-xs text-zinc-500">{{ item.email }}</p>
          <p class="mt-2 text-xs text-zinc-500">{{ labels[item.status] }} · Solicitada em {{ formatDate(item.requestedAt) }}</p>
          <p v-if="item.resolvedAt" class="mt-1 text-xs text-zinc-500">
            Resolvida em {{ formatDate(item.resolvedAt) }} · {{ item.resolvedByName || (item.status === 'expired' ? 'Expiração automática' : 'Administrador não disponível') }}
          </p>
          <p v-else class="mt-1 text-xs text-zinc-500">Expira em {{ formatDate(item.expiresAt) }}</p>
        </div>
        <div v-if="item.status === 'pending'" class="flex shrink-0 gap-2">
          <button type="button" :disabled="busy || !!secret" class="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-semibold disabled:opacity-50" @click="select(item, 'reject')">Rejeitar</button>
          <button type="button" :disabled="busy || !!secret" class="h-9 rounded-lg bg-green-700 px-3 text-xs font-semibold text-white disabled:opacity-50" @click="select(item, 'approve')">Aprovar</button>
        </div>
      </li>
    </ul>
    <footer v-if="total > 50" class="flex items-center justify-between border-t border-zinc-100 p-4 text-xs">
      <button :disabled="page === 1 || loading" @click="page--">Anterior</button>
      <span>Página {{ page }} de {{ Math.ceil(total / 50) }}</span>
      <button :disabled="page * 50 >= total || loading" @click="page++">Próxima</button>
    </footer>
    <BaseModal :model-value="!!selected || !!secret" :title="secret ? 'Senha temporária criada' : action === 'approve' ? 'Aprovar recuperação' : 'Rejeitar recuperação'"
      :show-close="!busy" :close-on-backdrop="!busy" :close-on-escape="!busy" @close="clear">
      <template v-if="secret">
        <p class="text-sm text-zinc-700">Senha temporária para <strong>{{ recipient }}</strong>:</p>
        <p class="mt-4 break-all rounded-xl bg-green-50 p-4 font-mono text-lg tracking-wide text-green-950" data-testid="temporary-password">{{ secret }}</p>
        <p class="mt-3 text-xs leading-5 text-zinc-500">Válida até {{ formatDate(expiresAt) }}. Entregue pelo procedimento interno. Esta senha será exibida somente agora e não poderá ser consultada novamente.</p>
      </template>
      <p v-else class="text-sm leading-6 text-zinc-600">
        {{ action === 'approve' ? 'Gerar uma senha temporária para' : 'Rejeitar a solicitação de' }} <strong>{{ selected?.email }}</strong>?
        <span v-if="action === 'approve'">As sessões e a senha atual serão invalidadas.</span>
      </p>
      <template #footer>
        <button v-if="secret" class="h-10 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white" @click="clear">Concluir e ocultar senha</button>
        <template v-else>
          <button :disabled="busy" class="h-10 rounded-lg border border-zinc-200 px-4 text-sm disabled:opacity-50" @click="clear">Cancelar</button>
          <button :disabled="busy" class="h-10 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="decide">
            {{ busy ? 'Processando…' : action === 'approve' ? 'Gerar senha temporária' : 'Confirmar rejeição' }}
          </button>
        </template>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, onMounted } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import { passwordRecoveryApi } from '@/services/passwordRecovery.js'
import { toast } from '@/composables/useToast'

const props = defineProps({revision:{type:Number,default:0}})
const labels = {pending:'Pendentes',completed:'Concluídas',rejected:'Rejeitadas',expired:'Expiradas'}
const items = ref([]), total = ref(0), status = ref('pending'), page = ref(1), loading = ref(false)
const selected = ref(null), action = ref(''), busy = ref(false), secret = ref(''), recipient = ref(''), expiresAt = ref(null)
let sequence = 0, active = true
const formatDate = value => new Date(value).toLocaleString('pt-BR')
function clear() { if (!busy.value) { secret.value = ''; recipient.value = ''; expiresAt.value = null; selected.value = null } }
function select(item, decision) { selected.value = item; action.value = decision }
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const result = await passwordRecoveryApi.list({status:status.value,page:page.value})
    if (current === sequence && active) { items.value = result.items; total.value = result.total }
  } catch (error) {
    if (current === sequence && active) { items.value = []; total.value = 0; toast.error(error.message) }
  } finally { if (current === sequence && active) loading.value = false }
}
async function decide() {
  if (busy.value || !selected.value) return
  busy.value = true
  const item = selected.value
  try {
    const result = await passwordRecoveryApi[action.value](item.id)
    if (!active) return
    if (action.value === 'approve') { secret.value = result.temporaryPassword; expiresAt.value = result.expiresAt; recipient.value = item.email }
    else toast.success(result.message)
    selected.value = null
    await load()
  } catch (error) { if (active) toast.error(error.message) }
  finally { busy.value = false }
}
watch(status, () => { page.value = 1; load() })
watch(page, load)
watch(() => props.revision, load)
function hideSecret() { secret.value = ''; recipient.value = ''; expiresAt.value = null; selected.value = null }
onMounted(() => { load(); window.addEventListener('pagehide',hideSecret) })
onBeforeUnmount(() => { active = false; sequence++; hideSecret(); window.removeEventListener('pagehide',hideSecret) })
</script>
