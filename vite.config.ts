import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:https` serves over HTTPS with a self-signed certificate.
// Phones only allow the Screen Wake Lock API on secure (HTTPS) origins.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
  preview: { host: true, port: 4173 },
}))
