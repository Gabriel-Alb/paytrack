<template>
    <article
        class="rounded-[14px] border border-black/[0.07] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.025)] transition-[border-color,box-shadow,transform] duration-200 sm:hover:-translate-y-px sm:hover:border-black/[0.11] sm:hover:shadow-[0_5px_14px_rgba(0,0,0,0.05)]">
        <div class="flex items-start gap-2.5">
            <div :class="[
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                iconClasses,
            ]">
                <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" aria-hidden="true">
                    <path :d="icon" fill="currentColor" />
                </svg>
            </div>

            <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                    <h4 class="truncate text-[13px] font-semibold leading-5 text-[#27272a]">
                        {{ title }}
                    </h4>

                    <time :datetime="notification.datetime" class="shrink-0 text-[10px] font-medium text-[#a1a1aa]">
                        {{ formattedTime }}
                    </time>
                </div>

                <p class="mt-0.5 truncate text-[12px] leading-5 text-[#71717a]">
                    {{ customerLabel }}

                    <strong class="font-medium text-[#3f3f46]">
                        {{ notification.customer }}
                    </strong>
                </p>

                <div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-[#71717a]">
                    <strong class="font-semibold text-[#3f3f46]">
                        {{ notification.amount }}
                    </strong>

                    <span class="text-[#d4d4d8]" aria-hidden="true">
                        •
                    </span>

                    <span>
                        Parcela

                        <strong class="font-semibold text-[#3f3f46]">
                            {{ notification.installment }}
                        </strong>
                    </span>

                    <template v-if="isOverdue">
                        <span class="text-[#d4d4d8]" aria-hidden="true">
                            •
                        </span>

                        <strong class="font-semibold text-[#b91c1c]">
                            {{ notification.overdueDays }}
                        </strong>
                    </template>
                </div>
            </div>
        </div>
    </article>
</template>

<script setup>
import {
    mdiAlertCircleOutline,
    mdiCheckCircleOutline,
} from '@mdi/js'

import { computed } from 'vue'

import { formatNotificationTime } from '../../../composables/useNotifications'

const props = defineProps({
    notification: {
        type: Object,
        required: true,
    },
})

const isOverdue = computed(() => {
    return props.notification.type === 'overdue'
})

const title = computed(() => {
    return isOverdue.value
        ? 'Parcela em atraso'
        : 'Pagamento efetuado'
})

const customerLabel = computed(() => {
    return isOverdue.value
        ? 'Cliente:'
        : 'Pagador:'
})

const icon = computed(() => {
    return isOverdue.value
        ? mdiAlertCircleOutline
        : mdiCheckCircleOutline
})

const iconClasses = computed(() => {
    return isOverdue.value
        ? 'bg-[#fdf0f0] text-[#b91c1c]'
        : 'bg-[#edf7f0] text-[#15803d]'
})

const formattedTime = computed(() => {
    return formatNotificationTime(props.notification.datetime)
})
</script>