<template>
    <header class="flex h-[60px] shrink-0 items-center justify-between border-b border-black/[0.06] bg-white px-4">
        <h2 id="notifications-title" class="text-[17px] font-semibold tracking-[-0.02em] text-[#18181b]">
            Notificações
        </h2>

        <button ref="closeButton" type="button" aria-label="Fechar notificações"
            class="flex h-8 w-8 items-center justify-center rounded-md text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#18181b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181b]"
            @click="emit('close')">
            <svg viewBox="0 0 24 24" class="h-[19px] w-[19px]" aria-hidden="true">
                <path :d="mdiClose" fill="currentColor" />
            </svg>
        </button>
    </header>
</template>

<script setup>
import { mdiClose } from '@mdi/js'
import { ref } from 'vue'

const emit = defineEmits(['close'])

const closeButton = ref(null)

const focusCloseButton = () => {
    closeButton.value?.focus()
}

defineExpose({
    focusCloseButton,
})
</script>