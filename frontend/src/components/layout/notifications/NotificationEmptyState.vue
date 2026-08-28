<template>
    <div class="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#a1a1aa] shadow-sm">
            <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                <path :d="mdiBellOutline" fill="currentColor" />
            </svg>
        </div>

        <h3 class="mt-3 text-[13px] font-semibold text-[#3f3f46]">
            Nenhuma notificação
        </h3>

        <p class="mt-1 text-[12px] text-[#a1a1aa]">
            Não existem alertas para este filtro.
        </p>
    </div>
</template>

<script setup>
import { mdiBellOutline } from '@mdi/js'
</script>