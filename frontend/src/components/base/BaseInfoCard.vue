<template>
    <article
        class="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        :class="interactive
            ? 'transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-[1px] hover:border-black/[0.09] hover:shadow-[0_4px_14px_rgba(0,0,0,0.035)]'
            : ''
            ">
        <slot />
    </article>
</template>

<script setup>
defineProps({
    interactive: {
        type: Boolean,
        default: true,
    },
})
</script>