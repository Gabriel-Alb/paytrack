<template>
  <BaseModal
    :model-value="isOpen && user?.role === 'admin'"
    title="Atenção"
    centered
    panel-class="max-w-[440px]"
    footer-class="!border-t-0"
    :close-on-backdrop="false"
    :close-on-escape="false"
    @close="closeNotice"
  >
    <template #header>
      <div class="flex min-h-9 items-center gap-2 text-[#166534]">
        <span class="mdi mdi-information-outline text-[22px]" aria-hidden="true" />
        <h2 class="text-base font-semibold">Atenção</h2>
      </div>
    </template>

    <p class="text-sm leading-6 text-[#3f3f46]">A data de vencimento estabelecida para o pagamento é 13/11/2026. Caso o pagamento permaneça pendente após essa data, o acesso ao sistema poderá ser temporariamente suspenso até a regularização.</p>

    <template #footer>
      <p class="col-span-2 w-full text-right text-xs text-[#71717a]">Mensagem automática do sistema</p>
    </template>
  </BaseModal>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseModal from '@/components/base/BaseModal.vue'
import { useAuth } from '@/composables/useAuth'
import { currentDate } from '@/services/paytrack'

// Controle manual: permanece ativo, sem data de encerramento, até ser definido como false.
const PAYMENT_NOTICE_ENABLED = true
const PAYMENT_NOTICE_START_DATE = '2026-11-12'
// Início da repetição no horário de São Paulo, mesmo com a página já aberta.
const PAYMENT_NOTICE_REPEAT_START = new Date('2026-11-14T00:00:00-03:00').getTime()
const PAYMENT_NOTICE_REPEAT_MS = 2 * 60 * 1000

const { user } = useAuth()
const route = useRoute()
const isOpen = ref(false)
let reminderTimer

function canShowNotice() {
  return PAYMENT_NOTICE_ENABLED && user.value?.role === 'admin' && currentDate() >= PAYMENT_NOTICE_START_DATE
}

function clearReminder() {
  clearTimeout(reminderTimer)
  reminderTimer = undefined
}

function showNotice() {
  clearReminder()
  isOpen.value = canShowNotice()
}

function scheduleReminder() {
  clearReminder()
  if (!canShowNotice() || isOpen.value) return

  const untilRepeatStart = PAYMENT_NOTICE_REPEAT_START - Date.now()
  if (untilRepeatStart > 0) {
    // Aguarda a data de início sem ultrapassar o limite de setTimeout do navegador.
    reminderTimer = setTimeout(scheduleReminder, Math.min(untilRepeatStart, 2_147_483_647))
    return
  }
  reminderTimer = setTimeout(showNotice, PAYMENT_NOTICE_REPEAT_MS)
}

function closeNotice() {
  isOpen.value = false
  scheduleReminder()
}

if (PAYMENT_NOTICE_ENABLED) {
  watch([() => route.fullPath, () => user.value?.id, () => user.value?.role], showNotice, { immediate: true })
}

onBeforeUnmount(clearReminder)
</script>
