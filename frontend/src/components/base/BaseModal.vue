<template>
    <Teleport to="body">
        <Transition name="base-modal">
            <div v-if="modelValue"
                class="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[2px] transition-[opacity,background-color] duration-200 sm:items-center sm:p-4"
                :class="{
                    'transition-none': dragging,
                }" :style="backdropStyle" @click.self="handleBackdropClick">
                <section role="dialog" aria-modal="true"
                    class="base-modal-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-10px_35px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-h-[88dvh] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(0,0,0,0.14)]"
                    :class="[
                        panelClass,
                        {
                            'transition-none': dragging,
                            'duration-200 ease-[cubic-bezier(0.4,0,1,1)]':
                                dismissing,
                        },
                    ]" :style="panelStyle">
                    <div class="flex h-8 shrink-0 touch-none select-none items-center justify-center sm:hidden" :class="dragging
                            ? 'cursor-grabbing'
                            : 'cursor-grab'
                        " @pointerdown="
                            startDrag(
                                $event,
                                requestClose,
                            )
                            " @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag">
                        <div class="h-[5px] rounded-full transition-[width,background-color,transform] duration-150"
                            :class="dragging
                                    ? 'w-[52px] scale-y-105 bg-[#166534]/40'
                                    : 'w-12 bg-black/[0.18]'
                                " />
                    </div>

                    <header
                        class="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] bg-white px-4 pb-4 pt-3 sm:px-6 sm:py-4">
                        <slot name="header">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">

                                    <h2 class="truncate text-base font-semibold text-[#202124]">
                                        {{ title }}
                                    </h2>
                                </div>

                                <p v-if="description" class="mt-1 truncate text-xs text-black/40">
                                    {{ description }}
                                </p>
                            </div>
                        </slot>

                        <button v-if="showClose" type="button"
                            class="flex size-9 shrink-0 items-center justify-center rounded-lg text-black/40 transition-colors hover:bg-black/[0.04] hover:text-black/60 active:bg-black/[0.06]"
                            aria-label="Fechar" @click="requestClose">
                            <span class="mdi mdi-close text-[21px]" />
                        </button>
                    </header>

                    <div class="flex-1 overflow-y-auto overscroll-contain p-4 sm:px-6 sm:py-5" :class="contentClass">
                        <slot />
                    </div>

                    <footer v-if="$slots.footer"
                        class="grid shrink-0 grid-cols-2 gap-2 border-t border-black/[0.06] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:flex sm:items-center sm:justify-end sm:px-6 sm:py-4"
                        :class="footerClass">
                        <slot name="footer" />
                    </footer>
                </section>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import {
    onBeforeUnmount,
    onMounted,
    watch,
} from 'vue'

import { useBottomSheetDrag } from '@/composables/useBottomSheetDrag'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },

    title: {
        type: String,
        default: '',
    },

    description: {
        type: String,
        default: '',
    },

    icon: {
        type: String,
        default: '',
    },

    panelClass: {
        type: String,
        default: 'sm:max-w-[560px]',
    },

    contentClass: {
        type: String,
        default: '',
    },

    footerClass: {
        type: String,
        default: '',
    },

    showClose: {
        type: Boolean,
        default: true,
    },

    closeOnBackdrop: {
        type: Boolean,
        default: true,
    },

    closeOnEscape: {
        type: Boolean,
        default: true,
    },
})

const emit = defineEmits([
    'update:modelValue',
    'close',
])

const {
    dragging,
    dismissing,
    panelStyle,
    backdropStyle,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    resetDrag,
} = useBottomSheetDrag()

function requestClose() {
    emit('update:modelValue', false)
    emit('close')
}

function handleBackdropClick() {
    if (!props.closeOnBackdrop) {
        return
    }

    requestClose()
}

function handleKeydown(event) {
    if (
        !props.modelValue ||
        !props.closeOnEscape
    ) {
        return
    }

    if (event.key === 'Escape') {
        requestClose()
    }
}

watch(
    () => props.modelValue,
    (open) => {
        if (open) {
            resetDrag()
        }
    },
)

onMounted(() => {
    window.addEventListener(
        'keydown',
        handleKeydown,
    )
})

onBeforeUnmount(() => {
    window.removeEventListener(
        'keydown',
        handleKeydown,
    )
})
</script>

<style scoped>
.base-modal-enter-active,
.base-modal-leave-active {
    transition: opacity 180ms ease;
}

.base-modal-enter-active .base-modal-panel,
.base-modal-leave-active .base-modal-panel {
    transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.base-modal-enter-from,
.base-modal-leave-to {
    opacity: 0;
}

.base-modal-enter-from .base-modal-panel,
.base-modal-leave-to .base-modal-panel {
    transform: translate3d(0, 100%, 0);
}

@media (min-width: 640px) {

    .base-modal-enter-from .base-modal-panel,
    .base-modal-leave-to .base-modal-panel {
        transform: translateY(24px);
    }
}

@media (prefers-reduced-motion: reduce) {

    .base-modal-enter-active,
    .base-modal-leave-active,
    .base-modal-enter-active .base-modal-panel,
    .base-modal-leave-active .base-modal-panel {
        transition: none;
    }
}
</style>