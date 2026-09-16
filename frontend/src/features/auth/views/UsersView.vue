<template>
  <div class="space-y-5">
    <section class="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
      <header
        class="flex flex-col gap-4 border-b border-black/[0.06] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 class="text-[15px] font-semibold text-zinc-900">
            Usuários e solicitações
          </h2>

          <p class="mt-1 text-xs text-zinc-500">
            Gerencie solicitações, acessos e permissões dos usuários.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <label for="status" class="whitespace-nowrap text-xs font-medium text-zinc-500">
            Status
          </label>

          <div class="relative">
            <select id="status" v-model="status"
              class="h-9 min-w-[142px] cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white py-0 pl-3 pr-9 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-300 focus:border-green-700/40 focus:ring-2 focus:ring-green-700/10">
              <option value="pending">Pendentes</option>
              <option value="active">Ativos</option>
              <option value="rejected">Rejeitados</option>
              <option value="blocked">Bloqueados</option>
            </select>

            <i class="mdi mdi-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-base text-zinc-400"
              aria-hidden="true" />
          </div>
        </div>
      </header>

      <div v-if="loading" class="flex min-h-[180px] items-center justify-center" role="status">
        <div class="flex items-center gap-2 text-sm text-zinc-500">
          <i class="mdi mdi-loading mdi-spin text-lg" aria-hidden="true" />
          Carregando usuários...
        </div>
      </div>

      <template v-else>
        <ul v-if="items.length" class="divide-y divide-black/[0.05]">
          <li v-for="person in items" :key="person.id"
            class="group flex flex-col gap-4 px-5 py-4 transition-colors duration-200 hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div class="flex min-w-0 items-start gap-3">
              <div :class="[
                'flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
                person.role === 'admin'
                  ? 'bg-orange-500/90'
                  : 'bg-purple-600',
              ]">
                <i :class="[
                  'mdi text-xl',
                  person.role === 'admin'
                    ? 'mdi-crown-outline'
                    : 'mdi-account-outline',
                ]" aria-hidden="true" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="break-words text-sm font-semibold text-zinc-900">
                    {{ person.name }}
                  </p>

                  <span :class="[
                    'rounded-md px-2 py-0.5 text-[10px] font-medium text-white',
                    person.role === 'admin'
                      ? 'bg-orange-500'
                      : 'bg-purple-600',
                  ]">
                    {{
                      person.role === 'admin'
                        ? 'Administrador'
                        : 'Usuário padrão'
                    }}
                  </span>
                </div>

                <p class="mt-1 break-all text-xs text-zinc-500">
                  {{ person.email }}
                </p>
              </div>
            </div>

            <button type="button"
              class="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              @click="selected = person.id">

              Ver acesso
            </button>
          </li>
        </ul>

        <div v-else class="flex min-h-[190px] flex-col items-center justify-center px-6 py-8 text-center">
          <i class="mdi mdi-account-search-outline text-3xl text-zinc-300" aria-hidden="true" />

          <p class="mt-2 text-sm font-medium text-zinc-700">
            Nenhum usuário encontrado
          </p>

          <p class="mt-1 text-xs text-zinc-400">
            Não existem usuários neste status no momento.
          </p>
        </div>
      </template>

      <footer v-if="!loading && total > 50"
        class="flex items-center justify-between border-t border-black/[0.06] px-5 py-3.5 sm:px-6">
        <p class="text-xs text-zinc-500">
          Página
          <span class="font-medium text-zinc-700">{{ page }}</span>
          de
          <span class="font-medium text-zinc-700">
            {{ totalPages }}
          </span>
        </p>

        <div class="flex items-center gap-1.5">
          <button type="button" :disabled="page === 1" aria-label="Página anterior"
            class="flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            @click="page--">
            <i class="mdi mdi-chevron-left text-lg" aria-hidden="true" />
          </button>

          <button type="button" :disabled="page >= totalPages" aria-label="Próxima página"
            class="flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            @click="page++">
            <i class="mdi mdi-chevron-right text-lg" aria-hidden="true" />
          </button>
        </div>
      </footer>

      <AccessReviewModal :user-id="selected" @close="selected = null" @updated="updated" />
    </section>

    <CompaniesManager />
  </div>
</template>

<script setup>
import { toast } from '@/composables/useToast'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import { request, watchAccessChanges } from '@/services/api'
import CompaniesManager from '../components/CompaniesManager.vue'
import AccessReviewModal from '../components/AccessReviewModal.vue'

const status = ref('pending')
const items = ref([])
const total = ref(0)
const page = ref(1)
const selected = ref(null)
const loading = ref(false)


const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / 50)),
)

let sequence = 0
let stopWatching

async function load(background = false) {
  const id = ++sequence

  if (!background) {
    loading.value = true
  }

  try {
    const result = await request(
      `/users?status=${status.value}&page=${page.value}`,
    )

    if (id !== sequence) {
      return
    }

    items.value = result.items
    total.value = result.total
  } catch (failure) {
    if (id === sequence) {
      toast.error(failure.message)
    }
  } finally {
    if (id === sequence) {
      loading.value = false
    }
  }
}

function updated() {
  selected.value = null
  load()
}

watch(status, () => {
  page.value = 1
  load()
})

watch(page, () => {
  load()
})

onMounted(() => {
  stopWatching = watchAccessChanges(() => load(true))
  load()
})

onBeforeUnmount(() => {
  sequence++
  stopWatching?.()
})
</script>