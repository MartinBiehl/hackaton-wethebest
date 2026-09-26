import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // PORT permite rodar ao lado de outro servidor de desenvolvimento.
  server: { port: Number(process.env.PORT) || 5173 },
})
