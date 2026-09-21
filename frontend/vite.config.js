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
    {
      name: 'validate-api-url',
      configResolved(config) {
        // Use Vite's resolved env (including .env.production and build variables).
        if (config.command === 'build' && !config.env.VITE_API_URL?.trim()) {
          throw new Error('Defina VITE_API_URL antes do build: URL do backend terminada em /api para API separada, ou /api quando houver proxy no mesmo domínio.')
        }
      },
    },
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
