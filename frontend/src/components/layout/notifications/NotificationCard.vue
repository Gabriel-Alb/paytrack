<template>
    <article
        class="rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.025)] transition-[border-color,box-shadow,transform] duration-200 sm:hover:-translate-y-px sm:hover:border-black/[0.11] sm:hover:shadow-[0_5px_14px_rgba(0,0,0,0.05)]">
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

                    <time :datetime="notification.datetime" class="shrink-0 text-[10px] font-medium text-[#71717a]">
                        {{ formattedTime }}
                    </time>
                </div>

                <p v-if="notification.event" class="mt-0.5 text-[12px] leading-5 text-[#71717a]">{{ message }}</p>
                <p v-else class="mt-0.5 truncate text-[12px] leading-5 text-[#71717a]">
                    {{ customerLabel }}

                    <strong class="font-medium text-[#3f3f46]">
                        {{ notification.customer }}
                    </strong>
                </p>

                <p v-if="notification.responsible && notification.type !== 'registration'" class="mt-0.5 text-[12px] leading-5 text-[#71717a]">
                    {{ notification.type === 'payment' ? (notification.event === 'payment_voided' ? 'Estornado por' : 'Lançado por') : 'Responsável' }}: {{ notification.responsible }}
                </p>

                <button v-if="notification.type === 'access'" type="button" class="mt-3 min-h-11 rounded-lg bg-[#edf7ef] px-3 text-xs font-semibold text-[#166534]" @click="$emit('review', notification.userId)">Avaliar solicitação</button>
                <div v-else-if="notification.type === 'loan'" class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-[#71717a]">
                    <span>{{ notification.installment_count }} parcelas</span><span aria-hidden="true">•</span>
                    <span>Empréstimo: {{ formatDate(notification.loan_date) }}</span><span aria-hidden="true">•</span>
                    <span>Data final: {{ formatDate(notification.end_date) }}</span>
                </div>
                <div v-else-if="notification.type !== 'registration'" class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-[#71717a]">
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
defineEmits(['review'])

const isOverdue = computed(() => {
    return props.notification.type === 'overdue'
})

const title = computed(() => {
    if (props.notification.type === 'access') return 'Solicitação de acesso'
    const titles = {client_created:'Cadastro de cliente',client_updated:'Cadastro atualizado',loan_created:'Novo empréstimo',loan_updated:'Empréstimo atualizado',loan_cancelled:'Empréstimo cancelado',installments_updated:'Parcelas atualizadas',payment_created:'Pagamento recebido',payment_corrected:'Pagamento corrigido',payment_voided:'Pagamento estornado'}
    if (titles[props.notification.event]) return titles[props.notification.event]
    return isOverdue.value
        ? 'Parcela em atraso'
        : 'Pagamento recebido'
})

const message = computed(() => {
    const item = props.notification
    if (item.type === 'registration') return `${item.responsible} ${item.event === 'client_created' ? 'cadastrou' : 'atualizou o cadastro de'} ${item.customer}.`
    if (item.type === 'loan') return `${title.value} de ${item.amount} para ${item.customer}.`
    return `${title.value} de ${item.customer}.`
})
const formatDate = (value) => value ? value.split('-').reverse().join('/') : 'Não informado'

const customerLabel = computed(() => {
    if (props.notification.type === 'access') return 'Solicitante:'
    return isOverdue.value
        ? 'Cliente:'
        : 'De:'
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
