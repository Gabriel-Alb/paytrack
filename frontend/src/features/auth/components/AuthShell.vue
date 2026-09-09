<template>
  <main class="flex min-h-dvh items-center justify-center bg-[#f6f7f8] px-4 py-8 text-[#18181b] sm:py-12">
    <section class="w-full rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm sm:p-9" :class="wide ? 'max-w-2xl' : 'max-w-md'">
      <div class="mb-8 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-[#166534] font-bold text-white">P</div>
        <div><p class="text-lg font-semibold tracking-tight">PayTrack</p><p class="text-xs text-[#71717a]">Gestão financeira</p></div>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p class="mt-2 mb-6 text-sm leading-6 text-[#71717a]">{{ description }}</p>
      <slot />
    </section>
  </main>
</template>
<script setup>
defineProps({title:{type:String,required:true},description:{type:String,default:''},wide:Boolean})
</script>
