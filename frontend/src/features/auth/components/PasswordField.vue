<template>
  <div>
    <label :for="id" class="mb-2 block text-sm font-medium text-[#3f3f46]">{{ label }}</label>
    <div class="relative">
      <input :id="id" v-model="value" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete" required
        :aria-describedby="hint ? `${id}-hint` : undefined"
        class="h-12 w-full min-w-0 rounded-lg border border-black/15 bg-white px-3 pr-24 text-base outline-none focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/15" />
      <button type="button" :aria-label="`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`" :aria-pressed="visible"
        class="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-medium text-[#166534] focus-visible:outline-2" @click="visible = !visible">
        {{ visible ? 'Ocultar' : 'Mostrar' }}
      </button>
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="mt-2 text-xs leading-5 text-[#71717a]">{{ hint }}</p>
  </div>
</template>
<script setup>
import { ref } from 'vue'
defineProps({id:{type:String,required:true},label:{type:String,default:'Senha'},autocomplete:{type:String,default:'new-password'},hint:{type:String,default:''}})
const value = defineModel({type:String,default:''})
const visible = ref(false)
</script>
