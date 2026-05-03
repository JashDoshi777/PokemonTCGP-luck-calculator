import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { expressApp } from './netlify/functions/api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'express-plugin',
      configureServer(server) {
        server.middlewares.use(expressApp);
      }
    }
  ],
})
