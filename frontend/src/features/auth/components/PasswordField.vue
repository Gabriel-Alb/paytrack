<template>
  <div>
    <label :for="id" :class="hideLabel ? 'sr-only' : 'mb-2 block text-sm font-medium text-[#3f3f46]'">
      {{ label }}
    </label>

    <div class="relative">
      <input :id="id" v-model="value" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete"
        :placeholder="placeholder" required :minlength="PASSWORD_MIN_LENGTH" :maxlength="PASSWORD_MAX_LENGTH" :aria-describedby="hint ? `${id}-hint` : undefined"
        class="h-10 w-full rounded-xl border border-black/[0.12] bg-[#fafafa] px-3.5 pr-10 text-[13px] text-[#18181b] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-black/45 hover:border-black/[0.16] focus:border-[#166534]/70 focus:bg-white focus:ring-4 focus:ring-[#166534]/[0.07] lg:h-[46px] lg:px-4 lg:pr-11 lg:text-sm" />

      <button type="button" :aria-label="`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`"
        :aria-pressed="visible"
        class="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-black/45 transition-colors duration-200 hover:text-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]/20 lg:w-11"
        @click="visible = !visible">
        <span class="mdi text-[17px] lg:text-[18px]" :class="visible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          aria-hidden="true" />
      </button>
    </div>

    <p v-if="hint" :id="`${id}-hint`" class="mt-2 text-xs leading-5 text-[#71717a]">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../../../../shared/password.js'

defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Senha',
  },
  autocomplete: {
    type: String,
    default: 'new-password',
  },
  hint: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  hideLabel: Boolean,
})

const value = defineModel({
  type: String,
  default: '',
})

const visible = ref(false)
</script>
