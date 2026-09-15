<template>
  <label class="block min-w-0 text-sm">
    <span :class="filter ? 'sr-only' : 'mb-1.5 block text-xs font-medium text-black/50'">Empresa</span>
    <select aria-label="Empresa" :value="modelValue ?? ''" :required="!filter" :disabled="loading || (!filter && user?.role === 'user' && companies.length === 1)"
      :class="filter
        ? 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-[#52525b] outline-none focus:border-[#166534]/40 focus:shadow-[0_0_0_3px_rgba(22,101,52,0.08)]'
        : 'h-10 w-full rounded-[10px] border border-black/[0.09] bg-[#f8f8f8] px-3 text-sm text-[#202124] outline-none focus:border-[#166534] disabled:opacity-70'"
      @change="$emit('update:modelValue', $event.target.value ? Number($event.target.value) : null)">
      <option value="">{{ filter ? 'Todas as empresas' : loading ? 'Carregando…' : 'Selecione a empresa' }}</option>
      <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
    </select>
  </label>
</template>
<script setup>
import { toast } from '@/composables/useToast'
import { ref, watch } from 'vue'
import { request } from '@/services/api'
import { useAuth } from '@/composables/useAuth'
const props = defineProps({ modelValue: {type:Number,default:null}, filter:Boolean, active:{type:Boolean,default:true} })
const emit = defineEmits(['update:modelValue'])
const { user } = useAuth()
const companies = ref([]), loading = ref(false)
let sequence = 0
async function load() {
  const version = ++sequence
  loading.value = true
  try {
    const result = await request('/companies')
    if (version !== sequence) return
    companies.value = result
    if (!result.length) toast.warning('Nenhuma empresa disponível. Solicite acesso ao administrador.')
    if (props.modelValue && !result.some(company => company.id === props.modelValue)) emit('update:modelValue',null)
    if (!props.filter && user.value?.role === 'user' && result.length === 1) emit('update:modelValue',result[0].id)
  } catch (failure) { if (version === sequence) toast.error(failure, { action: { label: 'Tentar novamente', run: load } }) }
  finally { if (version === sequence) loading.value = false }
}
watch(() => props.active, active => { if (active) load() }, { immediate:true })
</script>
