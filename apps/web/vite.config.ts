import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleFieldApi } from '../../scripts/field-cache/http.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(root, '../..')

export default defineConfig(({ mode }) => {
  // Load repo-root .env into process.env for field-cache (EARTHDATA_*, CURRENT_SOURCE, …)
  const env = loadEnv(mode, repo, '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v
  }
  const ncviewUpstream = (process.env.NCVIEW_UPSTREAM || 'http://127.0.0.1:8770').replace(/\/$/, '')

  return {
    plugins: [
      vue(),
      {
        name: 'aether-health-and-fields',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const raw = req.url || '/'
            const pathname = raw.split('?')[0] || ''
            if (pathname === '/health') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ status: 'ok', service: 'aether-demo-shell' }))
              return
            }
            if (pathname === '/ncview') {
              res.statusCode = 302
              res.setHeader('Location', '/regional')
              res.end()
              return
            }
            try {
              if (pathname.startsWith('/api/fields') && (await handleFieldApi(req, res))) return
            } catch (e) {
              console.warn('[aether] field api', e)
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'field api' }))
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
      proxy: {
        '/ncview/': {
          target: ncviewUpstream,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ncview/, '') || '/',
        },
      },
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
  }
})
