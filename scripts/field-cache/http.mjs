/**
 * Shared HTTP handlers for Vite middleware and production server.mjs.
 * Routes:
 *   GET  /api/fields/status
 *   GET  /api/fields/:packId/meta.json
 *   GET  /api/fields/:packId/{u,v,mask,scalar}.bin
 *   POST /api/fields/:packId/refresh
 */
import fs from 'node:fs'
import path from 'node:path'
import { ensureLivePack, packPath, readPackMeta, statusPayload, OCEAN_PACKS } from './ensure.mjs'

const BIN_FILES = new Set(['u.bin', 'v.bin', 'mask.bin', 'scalar.bin', 'meta.json'])

function sendJson(res, status, body) {
  const raw = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(raw)
}

function sendFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    res.end('not found')
    return
  }
  const buf = fs.readFileSync(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', buf.length)
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.end(buf)
}

function parsePackPath(pathname) {
  // /api/fields/global/ocean/meta.json
  const m = pathname.match(/^\/api\/fields\/(.+)$/)
  if (!m) return null
  const rest = m[1]
  if (rest === 'status') return { kind: 'status' }
  const parts = rest.split('/')
  if (parts.length < 2) return null
  // pack is two segments for our ids: global/ocean, regional/currents
  const file = parts[parts.length - 1]
  const packId = parts.slice(0, -1).join('/')
  if (file === 'refresh') return { kind: 'refresh', packId }
  if (!BIN_FILES.has(file)) return null
  return { kind: 'file', packId, file }
}

/**
 * @returns {boolean} true if handled
 */
export async function handleFieldApi(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const parsed = parsePackPath(url.pathname)
  if (!parsed) return false

  if (parsed.kind === 'status') {
    sendJson(res, 200, statusPayload())
    return true
  }

  if (parsed.kind === 'refresh') {
    if (req.method !== 'POST' && req.method !== 'GET') {
      sendJson(res, 405, { error: 'method' })
      return true
    }
    const result = await ensureLivePack(parsed.packId)
    sendJson(res, result.ok ? 200 : 503, result)
    return true
  }

  if (parsed.kind === 'file') {
    // Auto-ensure ocean packs on meta.json miss / stale
    if (parsed.file === 'meta.json' && OCEAN_PACKS.has(parsed.packId)) {
      const ensured = await ensureLivePack(parsed.packId)
      if (!ensured.ok) {
        sendJson(res, 503, { error: 'live unavailable', ...ensured })
        return true
      }
    }
    const filePath = path.join(packPath(parsed.packId), parsed.file)
    // path traversal guard
    const root = packPath(parsed.packId)
    if (!path.resolve(filePath).startsWith(path.resolve(root))) {
      sendJson(res, 403, { error: 'forbidden' })
      return true
    }
    if (parsed.file === 'meta.json') {
      const meta = readPackMeta(parsed.packId)
      if (!meta) {
        sendJson(res, 404, { error: 'no pack' })
        return true
      }
      sendJson(res, 200, meta)
      return true
    }
    const type = parsed.file.endsWith('.bin') ? 'application/octet-stream' : 'application/json'
    sendFile(res, filePath, type)
    return true
  }

  return false
}
