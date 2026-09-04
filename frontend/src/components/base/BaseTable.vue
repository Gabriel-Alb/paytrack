<template>
    <section class="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <slot name="toolbar" />

        <template v-if="items.length">
            <div class="hidden overflow-x-auto md:block">
                <table class="w-full border-collapse" :style="{ minWidth: minWidth }">
                    <thead>
                        <tr
                            class="border-b border-black/[0.06] bg-[#fafafa] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-black/35">
                            <th v-for="column in columns" :key="column.key" :class="column.headerClass">
                                {{ column.label }}
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="(item, index) in items" :key="resolveRowKey(item, index)"
                            class="border-b border-black/[0.05] transition-colors last:border-b-0 hover:bg-[#166534]/[0.018]">
                            <td v-for="column in columns" :key="column.key" :class="column.cellClass">
                                <slot :name="`cell-${column.key}`" :item="item" :column="column" :index="index">
                                    {{ getValue(item, column.key) }}
                                </slot>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div :class="[
                'md:hidden',
                mobileContainerClass,
            ]">
                <slot v-for="(item, index) in items" :key="resolveRowKey(item, index)" name="mobile-item" :item="item"
                    :index="index" />
            </div>
        </template>

        <slot v-else name="empty">
            <div class="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
                <p class="text-sm font-semibold text-[#202124]">
                    Nenhum registro encontrado
                </p>
            </div>
        </slot>
    </section>
</template>

<script setup>
const props = defineProps({
    columns: {
        type: Array,
        required: true,
    },

    items: {
        type: Array,
        default: () => [],
    },

    rowKey: {
        type: [String, Function],
        default: 'id',
    },

    minWidth: {
        type: String,
        default: '1000px',
    },

    mobileContainerClass: {
        type: String,
        default: '',
    },
})

function resolveRowKey(item, index) {
    if (typeof props.rowKey === 'function') {
        return props.rowKey(item, index)
    }

    return item?.[props.rowKey] ?? index
}

function getValue(item, key) {
    const value = item?.[key]

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '—'
    }

    return value
}
</script>