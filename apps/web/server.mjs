import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleFieldApi } from '../../scripts/field-cache/http.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const repoRoot = path.resolve(__dirname, '../..')

// Load repo-root .env (KEY=VAL) without printing values
try {
  const envPath = path.join(repoRoot, '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
} catch {}
const PORT = Number(process.env.PORT || 8765)
const HOST = process.env.HOST || '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.nc': 'application/x-netcdf',
  '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pmtiles': 'application/vnd.pmtiles',
  '.pbf': 'application/x-protobuf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  if (url.pathname === '/health') {
    send(res, 200, JSON.stringify({ status: 'ok', service: 'aether-demo-shell' }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    return
  }
  if (url.pathname.startsWith('/api/fields')) {
    try {
      if (await handleFieldApi(req, res)) return
    } catch (e) {
      send(res, 500, JSON.stringify({ error: 'field api' }), {
        'Content-Type': 'application/json; charset=utf-8',
      })
      return
    }
  }

  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  const file = path.normalize(path.join(dist, pathname))
  if (!file.startsWith(dist)) {
    send(res, 403, 'forbidden')
    return
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file)
    const type = MIME[ext] || 'application/octet-stream'
    const stat = fs.statSync(file)
    const range = req.headers.range
    const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null
    if (m) {
      const start = Number(m[1])
      const end = m[2] ? Number(m[2]) : stat.size - 1
      res.writeHead(206, {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1,
        'Cache-Control': 'public, max-age=86400',
      })
      fs.createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
    })
    fs.createReadStream(file).pipe(res)
    return
  }
  const index = path.join(dist, 'index.html')
  if (fs.existsSync(index)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(index).pipe(res)
    return
  }
  send(res, 503, 'dist not built — run pnpm build')
})

server.listen(PORT, HOST, () => {
  console.log(`[aether-demo-shell] http://${HOST}:${PORT}`)
})
