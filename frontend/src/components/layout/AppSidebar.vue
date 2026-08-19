<template>
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-black/[0.07] bg-white lg:flex">
        <div class="flex h-[76px] items-center px-6">
            <RouterLink to="/" class="flex items-center gap-3">
                <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#166534] text-sm font-bold text-white">
                    P
                </div>

                <div>
                    <p class="text-[17px] font-semibold tracking-[-0.02em] text-[#18181b]">
                        PayTrack
                    </p>
                    <p class="mt-0.5 text-[11px] font-medium text-[#a1a1aa]">
                        Gestão financeira
                    </p>
                </div>
            </RouterLink>
        </div>

        <nav class="flex-1 px-3 py-4">
            <p class="mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-[#a1a1aa] uppercase">
                Principal
            </p>

            <RouterLink to="/"
                class="flex h-11 items-center rounded-xl bg-[#f0fdf4] px-3 text-[13px] font-semibold text-[#166534]">
                Dashboard
            </RouterLink>

            <div class="mt-1 flex h-11 items-center rounded-xl px-3 text-[13px] font-medium text-[#71717a]">
                Clientes
            </div>

            <div class="mt-1 flex h-11 items-center rounded-xl px-3 text-[13px] font-medium text-[#71717a]">
                Empréstimos
            </div>

            <div class="mt-1 flex h-11 items-center rounded-xl px-3 text-[13px] font-medium text-[#71717a]">
                Pagamentos
            </div>

            <p class="mt-8 mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-[#a1a1aa] uppercase">
                Gestão
            </p>

            <div class="flex h-11 items-center rounded-xl px-3 text-[13px] font-medium text-[#71717a]">
                Inadimplentes
            </div>

            <div class="mt-1 flex h-11 items-center rounded-xl px-3 text-[13px] font-medium text-[#71717a]">
                Relatórios
            </div>
        </nav>

        <div class="border-t border-black/[0.06] p-4">
            <div class="flex items-center gap-3 rounded-xl px-2 py-2">
                <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-xs font-semibold text-[#52525b]">
                    GA
                </div>

                <div class="min-w-0">
                    <p class="truncate text-[13px] font-semibold text-[#27272a]">
                        Gabriel
                    </p>
                    <p class="truncate text-[11px] text-[#a1a1aa]">
                        Administrador
                    </p>
                </div>
            </div>
        </div>
    </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>