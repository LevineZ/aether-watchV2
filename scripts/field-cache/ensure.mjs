/**
 * Ensure a live FieldFrame pack exists under FIELD_CACHE_DIR (default .cache/fields).
 * Ocean → Python OSCAR fetcher (6h TTL). Wind/temp/precip → stub (OM later) → demo fallback.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function loadDotEnv() {
  const envPath = path.join(repoRoot, '.env')
  if (!fs.existsSync(envPath)) return
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
loadDotEnv()

export const OCEAN_PACKS = new Set(['global/ocean', 'regional/currents'])
export const OM_STUB_PACKS = new Set([
  'global/wind',
  'global/temp',
  'global/precip',
  'china/wind',
  'china/temp',
  'china/precip',
  'regional/temp',
  'regional/precip',
  'forecast/china',
])

export function cacheRoot() {
  return path.resolve(repoRoot, process.env.FIELD_CACHE_DIR || '.cache/fields')
}

export function ttlSeconds() {
  const n = Number(process.env.FIELD_CACHE_TTL_SECONDS || 21600)
  return Number.isFinite(n) && n >= 60 ? n : 21600
}

export function hasEarthdataCreds() {
  const token = (process.env.EARTHDATA_TOKEN || '').trim()
  const user = (process.env.EARTHDATA_USERNAME || '').trim()
  const pass = (process.env.EARTHDATA_PASSWORD || '').trim()
  return Boolean(token || (user && pass))
}

export function packPath(packId) {
  return path.join(cacheRoot(), packId)
}

export function isPackFresh(packId) {
  const dir = packPath(packId)
  const meta = path.join(dir, 'meta.json')
  const u = path.join(dir, 'u.bin')
  const stamp = path.join(dir, '.fetched_at')
  if (!fs.existsSync(meta) || !fs.existsSync(u)) return false
  try {
    const mtime = fs.existsSync(stamp) ? fs.statSync(stamp).mtimeMs : fs.statSync(meta).mtimeMs
    return Date.now() - mtime <= ttlSeconds() * 1000
  } catch {
    return false
  }
}

function pythonBin() {
  const venv = path.join(repoRoot, '.venv-field', 'bin', 'python')
  if (fs.existsSync(venv)) return venv
  return process.env.PYTHON || 'python3'
}

function runOscar(packId) {
  const script = path.join(__dirname, 'fetch_oscar.py')
  return new Promise((resolve) => {
    const child = spawn(pythonBin(), [script, '--pack', packId], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => {
      out += d.toString()
    })
    child.stderr.on('data', (d) => {
      err += d.toString()
    })
    child.on('close', (code) => {
      let parsed = null
      try {
        const line = out.trim().split('\n').filter(Boolean).pop()
        parsed = line ? JSON.parse(line) : null
      } catch {
        parsed = null
      }
      resolve({ code, out, err, parsed })
    })
  })
}

/** @returns {Promise<{ok:boolean, source:'live'|'demo', reason?:string, packId:string, dir?:string}>} */
export async function ensureLivePack(packId) {
  if (OCEAN_PACKS.has(packId)) {
    const src = (process.env.CURRENT_SOURCE || 'auto').toLowerCase()
    if (src === 'demo' || src === 'off' || src === 'none') {
      return { ok: false, source: 'demo', packId, reason: 'CURRENT_SOURCE=demo' }
    }
    if (isPackFresh(packId)) {
      return { ok: true, source: 'live', packId, dir: packPath(packId), cached: true }
    }
    if (!hasEarthdataCreds()) {
      return { ok: false, source: 'demo', packId, reason: 'missing EARTHDATA creds' }
    }
    const result = await runOscar(packId)
    if (result.parsed?.ok) {
      return {
        ok: true,
        source: 'live',
        packId,
        dir: packPath(packId),
        cached: !!result.parsed.cached,
        via: result.parsed.via,
        stamp: result.parsed.stamp,
      }
    }
    if (result.err) console.warn('[field-cache]', result.err.trim().slice(-500))
    return {
      ok: false,
      source: 'demo',
      packId,
      reason: result.parsed?.reason || `oscar exit ${result.code}`,
    }
  }

  // OM hook: wind/temp/precip stay demo for now; architecture ready.
  if (OM_STUB_PACKS.has(packId)) {
    return {
      ok: false,
      source: 'demo',
      packId,
      reason: 'OM live not wired yet (use demo; cache arch ready)',
    }
  }
  return { ok: false, source: 'demo', packId, reason: 'unknown pack' }
}

export function readPackMeta(packId) {
  const p = path.join(packPath(packId), 'meta.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export function statusPayload() {
  const packs = {}
  for (const id of [...OCEAN_PACKS, ...OM_STUB_PACKS]) {
    packs[id] = {
      fresh: isPackFresh(id),
      exists: fs.existsSync(path.join(packPath(id), 'meta.json')),
      ocean: OCEAN_PACKS.has(id),
      omStub: OM_STUB_PACKS.has(id),
    }
  }
  return {
    service: 'aether-field-cache',
    cacheDir: cacheRoot(),
    ttlSeconds: ttlSeconds(),
    hasEarthdataCreds: hasEarthdataCreds(),
    currentSource: process.env.CURRENT_SOURCE || 'auto',
    packs,
  }
}
