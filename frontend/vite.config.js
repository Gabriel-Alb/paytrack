import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => ({
  server: {
    host: '0.0.0.0',
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  plugins: [
    vue(),
    ...(command === 'serve' && mode !== 'test' ? [vueDevTools()] : []),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
