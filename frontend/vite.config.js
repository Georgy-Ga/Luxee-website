import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Слушать на всех сетевых интерфейсах (для доступа из локальной сети)
    port: 5173,
    strictPort: true,
  },
})
