import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(root, '../..')

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'aether-health',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/health') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ status: 'ok', service: 'aether-demo-shell' }))
            return
          }
          next()
        })
      },
    },
  ],
  publicDir: path.join(repo, 'public'),
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '@aether/field': path.join(repo, 'packages/field/src/index.ts'),
      '@aether/particles': path.join(repo, 'packages/particles/src/index.ts'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    host: '0.0.0.0',
    port: 8765,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 8765,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
