<template>
  <Teleport to="body">
    <section
      class="pointer-events-none fixed bottom-[max(24px,env(safe-area-inset-bottom))] right-[max(24px,env(safe-area-inset-right))] z-[1000] w-[min(390px,calc(100vw-32px))] max-sm:bottom-auto max-sm:left-[max(12px,env(safe-area-inset-left))] max-sm:right-[max(12px,env(safe-area-inset-right))] max-sm:top-[calc(4.5rem+env(safe-area-inset-top,0px))] max-sm:w-auto"
      aria-label="Notificações do sistema">
      <TransitionGroup tag="div" class="flex flex-col gap-2.5" enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 scale-[0.98] opacity-0" enter-to-class="translate-y-0 scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in" leave-from-class="translate-y-0 scale-100 opacity-100"
        leave-to-class="translate-y-1.5 scale-[0.98] opacity-0" move-class="transition-transform duration-200 ease-out">
        <article v-for="item in items" :key="item.id"
          class="pointer-events-auto flex min-h-[78px] items-start gap-3 rounded-2xl p-4 shadow-[0_8px_26px_rgba(24,24,27,0.12)] transition-shadow duration-200 max-sm:min-h-[72px] max-sm:gap-2.5 max-sm:p-3.5"
          :class="variants[item.type].container" :role="item.type === 'error' ? 'alert' : 'status'" aria-atomic="true"
          @mouseenter="pause(item.id, 'pointer', true)" @mouseleave="pause(item.id, 'pointer', false)"
          @focusin="pause(item.id, 'focus', true)" @focusout="handleFocusOut($event, item.id)">
          <div
            class="grid size-9 shrink-0 self-center place-items-center rounded-xl text-[19px] max-sm:size-8 max-sm:rounded-[10px] max-sm:text-[17px]"
            :class="variants[item.type].iconContainer">
            <i class="mdi" :class="variants[item.type].icon" aria-hidden="true"></i>
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-bold leading-tight" :class="variants[item.type].title">
              {{ variants[item.type].label }}
            </p>

            <p class="mt-1 max-h-[20dvh] overflow-y-auto break-words text-[13px] leading-[1.45] max-sm:text-[12px]"
              :class="variants[item.type].message">
              {{ item.message }}
            </p>

            <button v-if="item.action" type="button"
              class="mt-2.5 inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-[11px] font-semibold transition duration-150 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              :class="variants[item.type].action" @click="act(item)">
              {{ item.action.label }}
            </button>
          </div>

          <button type="button"
            class="grid size-8 shrink-0 self-center place-items-center rounded-lg text-[18px] transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:size-9"
            :class="variants[item.type].close" aria-label="Fechar notificação" @click="dismiss(item.id)">
            <i class="mdi mdi-close" aria-hidden="true"></i>
          </button>
        </article>
      </TransitionGroup>
    </section>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'

const {
  items,
  toast,
  dismiss,
  pause,
  setLimit,
  suspend,
} = useToast()

const variants = {
  success: {
    label: 'Sucesso',
    icon: 'mdi-check',
    container: 'bg-[#dcebdd] text-[#25452d]',
    iconContainer: 'bg-[#52745b] text-white',
    title: 'text-[#31563a]',
    message: 'text-[#3d5944]',
    action:
      'bg-[#52745b] text-white hover:bg-[#46654f] focus-visible:outline-[#52745b]',
    close:
      'text-[#52705a] hover:bg-[#caddcc] hover:text-[#284a31] focus-visible:outline-[#52745b]',
  },

  error: {
    label: 'Erro',
    icon: 'mdi-close',
    container: 'bg-[#f1dcdc] text-[#652f2f]',
    iconContainer: 'bg-[#a85d5d] text-white',
    title: 'text-[#7b3f3f]',
    message: 'text-[#714646]',
    action:
      'bg-[#a85d5d] text-white hover:bg-[#934f4f] focus-visible:outline-[#a85d5d]',
    close:
      'text-[#925656] hover:bg-[#e5c8c8] hover:text-[#6f3838] focus-visible:outline-[#a85d5d]',
  },

  warning: {
    label: 'Aviso',
    icon: 'mdi-alert-outline',
    container: 'bg-[#f3e8cd] text-[#624d23]',
    iconContainer: 'bg-[#9b7639] text-white',
    title: 'text-[#715726]',
    message: 'text-[#6d5a35]',
    action:
      'bg-[#9b7639] text-white hover:bg-[#87652f] focus-visible:outline-[#9b7639]',
    close:
      'text-[#8a6b35] hover:bg-[#e8d9b6] hover:text-[#60491f] focus-visible:outline-[#9b7639]',
  },

  info: {
    label: 'Informação',
    icon: 'mdi-information-outline',
    container: 'bg-[#dce6ee] text-[#314b61]',
    iconContainer: 'bg-[#5a748a] text-white',
    title: 'text-[#405d73]',
    message: 'text-[#4b6478]',
    action:
      'bg-[#5a748a] text-white hover:bg-[#4e667a] focus-visible:outline-[#5a748a]',
    close:
      'text-[#5e7486] hover:bg-[#cbd9e4] hover:text-[#38546b] focus-visible:outline-[#5a748a]',
  },
}

async function act(item) {
  dismiss(item.id)

  try {
    await item.action.run()
  } catch (error) {
    toast.error(error)
  }
}

function handleFocusOut(event, id) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    pause(id, 'focus', false)
  }
}

let media
let validationReset
let validating = false

function resize() {
  setLimit(media.matches ? 1 : 3)
}

function visibility() {
  suspend(document.hidden)
}

function invalid(event) {
  event.preventDefault()

  if (validating) return

  validating = true

  const input = event.target

  const label =
    input.getAttribute('aria-label')
    || input.labels?.[0]?.textContent?.trim()
    || 'Campo'

  toast.error(`${label}: ${input.validationMessage}`)

  input.focus()

  validationReset = setTimeout(() => {
    validating = false
  }, 0)
}

onMounted(() => {
  media = window.matchMedia('(max-width: 639px)')

  resize()
  visibility()

  media.addEventListener('change', resize)
  document.addEventListener('visibilitychange', visibility)
  document.addEventListener('invalid', invalid, true)
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', resize)
  document.removeEventListener('visibilitychange', visibility)
  document.removeEventListener('invalid', invalid, true)

  clearTimeout(validationReset)

  toast.clear()
})
</script>