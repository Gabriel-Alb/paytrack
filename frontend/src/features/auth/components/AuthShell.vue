<template>
  <main :class="split
      ? 'fixed inset-0 overflow-hidden bg-white text-[#18181b]'
      : 'min-h-dvh bg-[#f6f7f8] text-[#18181b]'
    ">
    <div v-if="split" class="grid h-full w-full overflow-hidden lg:grid-cols-[52%_48%]">
      <aside class="relative hidden h-full min-h-0 overflow-hidden bg-[#166534] lg:block">
        <img :src="backgroundImage" alt="" class="absolute inset-0 h-full w-full object-cover" />

        <div class="absolute inset-0 bg-gradient-to-br from-[#166534]/88 via-[#166534]/64 to-[#0f3f22]/90" />

        <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.16),transparent_34%)]" />

        <div class="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.28),transparent_42%)]" />

        <div class="relative z-10 flex h-full min-h-0 flex-col justify-between p-8 xl:p-10 2xl:p-12">
          <div class="flex items-center gap-3">
            <div
              class="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 backdrop-blur-md">
              <span class="text-sm font-bold text-white">
                P
              </span>
            </div>

            <span class="text-lg font-semibold tracking-[-0.03em] text-white">
              PayTrack
            </span>
          </div>

          <div class="max-w-[520px] pb-2">
            <p class="text-[34px] font-semibold leading-[1.08] tracking-[-0.045em] text-white xl:text-[42px]">
              Gestão de empréstimos.
            </p>

            <p class="mt-4 max-w-[420px] text-sm leading-6 text-white/70 xl:text-[15px]">
              Centralize clientes, empréstimos e pagamentos em um único lugar.
            </p>
          </div>
        </div>
      </aside>

      <section class="relative h-full min-h-0 min-w-0 lg:bg-white" :class="mobileScrollable
          ? 'overflow-y-auto overscroll-contain lg:overflow-hidden'
          : 'overflow-hidden'
        ">
        <div class="fixed inset-0 z-0 lg:hidden">
          <img :src="backgroundImage" alt="" class="h-full w-full scale-[1.03] object-cover" />

          <div class="absolute inset-0 bg-gradient-to-br from-[#166534]/90 via-[#166534]/76 to-[#0c3d20]/94" />

          <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.14),transparent_32%)]" />
        </div>

        <div
          class="pointer-events-none absolute right-[-180px] top-[-180px] hidden size-[420px] rounded-full bg-[#166534]/[0.035] blur-3xl lg:block" />

        <div
          class="relative z-10 flex min-h-full w-full justify-center px-4 lg:h-full lg:min-h-0 lg:items-center lg:px-14 xl:px-20"
          :class="mobileScrollable
              ? 'items-start py-5 sm:py-7 lg:py-0'
              : 'items-center py-0'
            ">
          <div
            class="w-full rounded-[20px] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
            :class="wide
                ? 'max-w-[560px] px-5 py-6 sm:px-6 lg:max-w-[620px]'
                : 'max-w-[330px] px-5 py-6 sm:max-w-[360px] sm:px-6 sm:py-7 lg:max-w-[390px]'
              ">
            <div :class="wide
                ? 'mb-5 lg:mb-6'
                : 'mb-5 lg:mb-8'
              ">
              <h1 class="font-semibold tracking-[-0.04em] text-[#18181b]" :class="wide
                  ? 'text-[24px] lg:text-[30px]'
                  : 'text-[25px] lg:text-[32px]'
                ">
                {{ title }}
              </h1>

              <p v-if="description" class="text-[13px] leading-5 text-[#71717a] lg:text-sm lg:leading-6">
                {{ description }}
              </p>
            </div>

            <slot />
          </div>
        </div>
      </section>
    </div>

    <section v-else class="flex min-h-dvh items-center justify-center px-4 py-8">
      <div class="w-full rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm sm:p-9"
        :class="wide ? 'max-w-2xl' : 'max-w-md'">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ title }}
        </h1>

        <p v-if="description" class="mt-2 mb-6 text-sm leading-6 text-[#71717a]">
          {{ description }}
        </p>

        <slot />
      </div>
    </section>
  </main>
</template>

<script setup>
import backgroundImage from '@/assets/img/image.png'

defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  wide: Boolean,
  split: Boolean,
  mobileScrollable: Boolean,
})
</script>