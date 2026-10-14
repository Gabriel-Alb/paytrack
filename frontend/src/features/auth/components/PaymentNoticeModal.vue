<template>
  <BaseModal
    :model-value="isOpen && user?.role === 'admin'"
    title="Atenção"
    centered
    panel-class="max-w-[440px]"
    footer-class="!border-t-0"
    :close-on-backdrop="false"
    :close-on-escape="false"
    @close="isOpen = false"
  >
    <template #header>
      <div class="flex min-h-9 items-center gap-2 text-[#166534]">
        <span class="mdi mdi-information-outline text-[22px]" aria-hidden="true" />
        <h2 class="text-base font-semibold">Atenção</h2>
      </div>
    </template>

    <p class="text-sm leading-6 text-[#3f3f46]">Solicitamos a regularização do pagamento conforme combinado, com prazo até 20/10/2026. Após essa data, o sistema poderá ser temporariamente desativado até a regularização do pagamento.</p>

    <template #footer>
      <p class="col-span-2 w-full text-right text-xs text-[#71717a]">Mensagem automática do sistema</p>
    </template>
  </BaseModal>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import { useAuth } from '@/composables/useAuth'
import { currentDate } from '@/services/paytrack'

const { user } = useAuth()
const isOpen = ref(false)
const sessionKey = 'paytrack:payment-notice:2026-10'

onMounted(() => {
  if (user.value?.role !== 'admin') return

  const today = currentDate()
  if (today < '2026-10-13' || today > '2026-10-30') return

  try {
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, 'shown')
    isOpen.value = true
  } catch {
    // Storage indisponível: não interromper o acesso nem repetir o aviso.
  }
})
</script>
