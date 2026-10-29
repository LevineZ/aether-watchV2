/**
 * Fetch Open-Meteo current fields → FieldFrame packs on disk.
 * Same shape as demo/OSCAR: meta.json + u.bin/v.bin [+ scalar.bin].
 *
 * Free-tier friendly: coarse sample + batch + pause + checkpoint resume.
 * On 429 keeps stale pack if present.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function loadDotEnv({ override = false } = {}) {
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
    // Always apply OPEN_METEO_* / FIELD_* from file so shell leftovers don't stick
    const force = override || /^(OPEN_METEO_|FIELD_CACHE_)/.test(k)
    if (force || process.env[k] === undefined) process.env[k] = v
  }
}
loadDotEnv({ override: true })

const USER_AGENT = 'AetherWatch-lite/0.1 (field-cache; open-meteo; no-nullschool)'

const SCOPES = {
  global: {
    stepDefault: 10,
    packs: {
      'global/wind': {
        nx: 721, ny: 361, bbox: [-180, -90, 180, 90], kind: 'wind',
        vars: ['u', 'v'], units: 'm/s', scalar: false,
      },
      'global/temp': {
        nx: 721, ny: 361, bbox: [-180, -90, 180, 90], kind: 'temp',
        vars: ['t2m'], units: 'degC', scalar: true,
      },
      'global/precip': {
        nx: 721, ny: 361, bbox: [-180, -90, 180, 90], kind: 'precip',
        vars: ['precip'], units: 'mm', scalar: true,
      },
    },
  },
  china: {
    stepDefault: 1,
    packs: {
      'china/wind': {
        nx: 249, ny: 145, bbox: [73, 18, 135, 54], kind: 'wind',
        vars: ['u', 'v'], units: 'm/s', scalar: false,
      },
      'china/temp': {
        nx: 249, ny: 145, bbox: [73, 18, 135, 54], kind: 'temp',
        vars: ['t2m'], units: 'degC', scalar: true,
      },
      'china/precip': {
        nx: 249, ny: 145, bbox: [73, 18, 135, 54], kind: 'precip',
        vars: ['precip'], units: 'mm', scalar: true,
      },
    },
  },
  regional: {
    stepDefault: 0.5,
    packs: {
      'regional/temp': {
        nx: 141, ny: 131, bbox: [117.5, 22, 131.5, 35], kind: 'temp',
        vars: ['t2m'], units: 'degC', scalar: true,
      },
      'regional/precip': {
        nx: 141, ny: 131, bbox: [117.5, 22, 131.5, 35], kind: 'precip',
        vars: ['precip'], units: 'mm', scalar: true,
      },
    },
  },
}

export const OM_PACKS = new Set(Object.values(SCOPES).flatMap((s) => Object.keys(s.packs)))

function env(name, def = '') {
  return (process.env[name] ?? def).toString().trim()
}

function cacheRoot() {
  return path.resolve(repoRoot, env('FIELD_CACHE_DIR', '.cache/fields'))
}

function ttlSeconds() {
  const n = Number(env('FIELD_CACHE_TTL_SECONDS', '21600'))
  return Number.isFinite(n) && n >= 60 ? n : 21600
}

function packDir(packId) {
  return path.join(cacheRoot(), packId)
}

function isFresh(packId) {
  const dir = packDir(packId)
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

function packExists(packId) {
  return fs.existsSync(path.join(packDir(packId), 'meta.json')) && fs.existsSync(path.join(packDir(packId), 'u.bin'))
}

function scopeOf(packId) {
  for (const [name, scope] of Object.entries(SCOPES)) {
    if (packId in scope.packs) return { name, ...scope }
  }
  return null
}

function sampleAxis(west, east, step) {
  const out = []
  for (let x = west; x <= east + 1e-9; x += step) out.push(Number(x.toFixed(6)))
  if (out.length === 0) out.push(west)
  out[out.length - 1] = east
  return out
}

function buildSampleGrid(bbox, step) {
  const [w, s, e, n] = bbox
  const lons = sampleAxis(w, e, step)
  const lats = sampleAxis(s, n, step)
  const latsList = []
  const lonsList = []
  for (let iy = 0; iy < lats.length; iy++) {
    for (let ix = 0; ix < lons.length; ix++) {
      latsList.push(lats[iy])
      lonsList.push(lons[ix])
    }
  }
  return { lons, lats, latsList, lonsList, nx: lons.length, ny: lats.length }
}

function omBaseUrl() {
  const key = env('OPEN_METEO_API_KEY')
  let base = env('OPEN_METEO_BASE', 'https://api.open-meteo.com').replace(/\/$/, '')
  if (key && !base.includes('customer-')) {
    base = base.replace('://api.', '://customer-api.')
  }
  return base
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchBatch(lats, lons) {
  const params = new URLSearchParams()
  params.set('latitude', lats.join(','))
  params.set('longitude', lons.join(','))
  params.set(
    'current',
    'temperature_2m,wind_u_component_10m,wind_v_component_10m,precipitation',
  )
  params.set('wind_speed_unit', 'ms')
  params.set('timezone', 'UTC')
  params.set('cell_selection', 'nearest')
  const model = env('OPEN_METEO_MODEL')
  if (model) params.set('models', model)
  const key = env('OPEN_METEO_API_KEY')
  if (key) params.set('apikey', key)

  const url = `${omBaseUrl()}/v1/forecast`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    body: params,
  })
  if (res.status === 429) {
    const err = new Error('OM 429 rate limited')
    err.code = 429
    const body = await res.text().catch(() => '')
    err.body = body
    throw err
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OM HTTP ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

function rawDir(scopeName, step) {
  return path.join(cacheRoot(), '_om_raw', `${scopeName}_s${String(step).replace('.', 'p')}`)
}

function loadCheckpoint(dir, n) {
  const prog = path.join(dir, 'progress.json')
  if (!fs.existsSync(prog)) return null
  try {
    const p = JSON.parse(fs.readFileSync(prog, 'utf8'))
    if (p.n !== n) return null
    const u = new Float32Array(fs.readFileSync(path.join(dir, 'u.bin')).buffer.slice(0))
    const v = new Float32Array(fs.readFileSync(path.join(dir, 'v.bin')).buffer.slice(0))
    const t = new Float32Array(fs.readFileSync(path.join(dir, 't.bin')).buffer.slice(0))
    const pr = new Float32Array(fs.readFileSync(path.join(dir, 'p.bin')).buffer.slice(0))
    if (u.length !== n) return null
    return { filled: p.filled || 0, time: p.time || null, u, v, t, p: pr }
  } catch {
    return null
  }
}

function saveCheckpoint(dir, { filled, time, u, v, t, p, n, nx, ny, step, lons, lats }) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'u.bin'), Buffer.from(u.buffer, u.byteOffset, u.byteLength))
  fs.writeFileSync(path.join(dir, 'v.bin'), Buffer.from(v.buffer, v.byteOffset, v.byteLength))
  fs.writeFileSync(path.join(dir, 't.bin'), Buffer.from(t.buffer, t.byteOffset, t.byteLength))
  fs.writeFileSync(path.join(dir, 'p.bin'), Buffer.from(p.buffer, p.byteOffset, p.byteLength))
  fs.writeFileSync(
    path.join(dir, 'progress.json'),
    JSON.stringify({ filled, time, n, nx, ny, step, lons, lats }, null, 2),
  )
}

async function fetchCoarseGrid(scopeName, bbox, step, onProgress) {
  const grid = buildSampleGrid(bbox, step)
  const batch = Math.max(5, Math.min(100, Number(env('OPEN_METEO_BATCH', '50')) || 50))
  const pause = Math.max(200, Number(env('OPEN_METEO_PAUSE_MS', '3000')) || 3000)
  const n = grid.latsList.length
  const dir = rawDir(scopeName, step)

  let u, v, t, p, filled = 0, timeIso = null
  const cp = loadCheckpoint(dir, n)
  if (cp) {
    ;({ u, v, t, p, filled, time: timeIso } = cp)
    console.warn(`[om] resume ${scopeName} from ${filled}/${n}`)
  } else {
    u = new Float32Array(n)
    v = new Float32Array(n)
    t = new Float32Array(n)
    p = new Float32Array(n)
  }

  for (let start = filled; start < n; start += batch) {
    const end = Math.min(n, start + batch)
    const la = grid.latsList.slice(start, end)
    const lo = grid.lonsList.slice(start, end)
    let rows = null
    let attempt = 0
    while (attempt < 10) {
      try {
        rows = await fetchBatch(la, lo)
        break
      } catch (e) {
        if (e && e.code === 429) {
          attempt++
          const minutely = String(e.body || '').includes('Minutely')
          const wait = minutely
            ? Math.min(90000, 15000 * attempt)
            : Math.min(120000, 10000 * attempt)
          console.warn(`[om] 429; backoff ${wait}ms (${attempt}/10)`, { start, end, minutely })
          // persist before waiting
          saveCheckpoint(dir, {
            filled: start, time: timeIso, u, v, t, p, n,
            nx: grid.nx, ny: grid.ny, step, lons: grid.lons, lats: grid.lats,
          })
          await sleep(wait)
          continue
        }
        throw e
      }
    }
    if (!rows) {
      saveCheckpoint(dir, {
        filled: start, time: timeIso, u, v, t, p, n,
        nx: grid.nx, ny: grid.ny, step, lons: grid.lons, lats: grid.lats,
      })
      const err = new Error('OM 429 exhausted')
      err.code = 429
      throw err
    }
    if (rows.length !== end - start) {
      throw new Error(`OM batch size mismatch got ${rows.length} want ${end - start}`)
    }
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i]?.current || {}
      const idx = start + i
      u[idx] = Number(cur.wind_u_component_10m ?? 0)
      v[idx] = Number(cur.wind_v_component_10m ?? 0)
      t[idx] = Number(cur.temperature_2m ?? 0)
      p[idx] = Number(cur.precipitation ?? 0)
      if (!timeIso && cur.time) {
        timeIso = cur.time.endsWith('Z') ? cur.time : `${cur.time}:00Z`.replace('::', ':')
      }
    }
    filled = end
    saveCheckpoint(dir, {
      filled, time: timeIso, u, v, t, p, n,
      nx: grid.nx, ny: grid.ny, step, lons: grid.lons, lats: grid.lats,
    })
    if (onProgress) onProgress({ filled, total: n })
    if (end < n) await sleep(pause)
  }

  return {
    nx: grid.nx,
    ny: grid.ny,
    lons: grid.lons,
    lats: grid.lats,
    u, v, t, p,
    time: timeIso || new Date().toISOString(),
    step,
  }
}

function upsample(src, srcNx, srcNy, srcLons, srcLats, tgtNx, tgtNy, bbox) {
  const [w, s, e, n] = bbox
  const out = new Float32Array(tgtNx * tgtNy)
  const lon0 = srcLons[0]
  const lat0 = srcLats[0]
  const dLon = srcLons.length > 1 ? (srcLons[srcLons.length - 1] - srcLons[0]) / (srcLons.length - 1) : 1
  const dLat = srcLats.length > 1 ? (srcLats[srcLats.length - 1] - srcLats[0]) / (srcLats.length - 1) : 1

  for (let iy = 0; iy < tgtNy; iy++) {
    const lat = s + (n - s) * (iy / Math.max(1, tgtNy - 1))
    let fy = (lat - lat0) / dLat
    if (fy < 0) fy = 0
    if (fy > srcNy - 1) fy = srcNy - 1
    const j0 = Math.floor(fy)
    const j1 = Math.min(srcNy - 1, j0 + 1)
    const ty = fy - j0
    for (let ix = 0; ix < tgtNx; ix++) {
      const lon = w + (e - w) * (ix / Math.max(1, tgtNx - 1))
      let fx = (lon - lon0) / dLon
      if (fx < 0) fx = 0
      if (fx > srcNx - 1) fx = srcNx - 1
      const i0 = Math.floor(fx)
      const i1 = Math.min(srcNx - 1, i0 + 1)
      const tx = fx - i0
      const a = src[j0 * srcNx + i0]
      const b = src[j0 * srcNx + i1]
      const c = src[j1 * srcNx + i0]
      const d = src[j1 * srcNx + i1]
      out[iy * tgtNx + ix] =
        a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
    }
  }
  return out
}

function writeF32(file, arr) {
  fs.writeFileSync(file, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength))
}

function writePack(packId, cfg, u, v, scalar, timeIso, extra = {}) {
  const d = packDir(packId)
  fs.mkdirSync(d, { recursive: true })
  writeF32(path.join(d, 'u.bin'), u)
  writeF32(path.join(d, 'v.bin'), v)
  if (cfg.scalar && scalar) writeF32(path.join(d, 'scalar.bin'), scalar)
  const meta = {
    nx: cfg.nx,
    ny: cfg.ny,
    bbox: cfg.bbox,
    time: timeIso,
    kind: cfg.kind,
    uFile: 'u.bin',
    vFile: 'v.bin',
    scalarFile: cfg.scalar ? 'scalar.bin' : null,
    maskFile: null,
    meta: {
      source: 'live',
      vars: cfg.vars,
      units: cfg.units,
      fill: 9999,
      rowOrder: 'south-north',
      endian: 'le',
      dtype: 'float32',
      note: extra.note || 'Open-Meteo forecast current',
      provider: 'open-meteo',
      model: env('OPEN_METEO_MODEL') || 'best_match',
      sampleStepDeg: extra.step,
      sampleNx: extra.sampleNx,
      sampleNy: extra.sampleNy,
      fetchedAt: new Date().toISOString(),
      ttlSeconds: ttlSeconds(),
    },
  }
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify(meta, null, 2))
  fs.writeFileSync(path.join(d, '.fetched_at'), String(Date.now() / 1000))
  return d
}

async function withLock(name, fn) {
  const lock = path.join(cacheRoot(), `.lock-${name}`)
  fs.mkdirSync(cacheRoot(), { recursive: true })
  for (let i = 0; i < 180; i++) {
    try {
      const fd = fs.openSync(lock, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      try {
        return await fn()
      } finally {
        try { fs.unlinkSync(lock) } catch {}
      }
    } catch {
      await sleep(500)
    }
  }
  return { ok: false, reason: 'lock timeout', fallback: 'demo' }
}

export async function fetchAndWrite(packId) {
  const src = env('OPEN_METEO_SOURCE', 'auto').toLowerCase()
  if (src === 'demo' || src === 'off' || src === 'none') {
    return { ok: false, reason: 'OPEN_METEO_SOURCE=demo', fallback: 'demo' }
  }
  const scope = scopeOf(packId)
  if (!scope) return { ok: false, reason: `unsupported pack ${packId}`, fallback: 'demo' }

  if (isFresh(packId)) {
    return { ok: true, cached: true, pack: packId, dir: packDir(packId) }
  }

  return withLock(`om-${scope.name}`, async () => {
    if (isFresh(packId)) {
      return { ok: true, cached: true, pack: packId, dir: packDir(packId) }
    }

    const firstCfg = Object.values(scope.packs)[0]
    const stepEnv = Number(env('OPEN_METEO_STEP_DEG', ''))
    // OPEN_METEO_STEP_DEG only overrides global; china/regional keep scope defaults
    const step =
      scope.name === 'global' && Number.isFinite(stepEnv) && stepEnv > 0
        ? stepEnv
        : scope.stepDefault

    console.warn(`[om] fetching scope=${scope.name} step=${step}° pack=${packId}`)
    let coarse
    try {
      coarse = await fetchCoarseGrid(scope.name, firstCfg.bbox, step, ({ filled, total }) => {
        if (filled === total || filled % 100 === 0) {
          console.warn(`[om] ${scope.name} ${filled}/${total}`)
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[om] fetch failed', msg)
      if (packExists(packId)) {
        return {
          ok: true, cached: true, stale: true, pack: packId,
          dir: packDir(packId), reason: msg, via: 'stale-cache',
        }
      }
      return { ok: false, reason: msg, fallback: 'demo', code: e?.code }
    }

    const written = []
    for (const [pid, cfg] of Object.entries(scope.packs)) {
      const uUp = upsample(coarse.u, coarse.nx, coarse.ny, coarse.lons, coarse.lats, cfg.nx, cfg.ny, cfg.bbox)
      const vUp = upsample(coarse.v, coarse.nx, coarse.ny, coarse.lons, coarse.lats, cfg.nx, cfg.ny, cfg.bbox)
      let scalar = null
      if (cfg.kind === 'temp') {
        scalar = upsample(coarse.t, coarse.nx, coarse.ny, coarse.lons, coarse.lats, cfg.nx, cfg.ny, cfg.bbox)
      } else if (cfg.kind === 'precip') {
        scalar = upsample(coarse.p, coarse.nx, coarse.ny, coarse.lons, coarse.lats, cfg.nx, cfg.ny, cfg.bbox)
      }
      writePack(pid, cfg, uUp, vUp, scalar, coarse.time, {
        step: coarse.step,
        sampleNx: coarse.nx,
        sampleNy: coarse.ny,
        note: `Open-Meteo current (${env('OPEN_METEO_MODEL') || 'best_match'}) step=${coarse.step}°`,
      })
      written.push(pid)
    }

    // clear raw checkpoint after success
    try {
      fs.rmSync(rawDir(scope.name, coarse.step), { recursive: true, force: true })
    } catch {}

    return {
      ok: true, cached: false, pack: packId, dir: packDir(packId),
      via: 'open-meteo', scope: scope.name, written,
      sample: { nx: coarse.nx, ny: coarse.ny, step: coarse.step },
      time: coarse.time,
    }
  })
}

export function statusPayloadOm() {
  const packs = {}
  for (const id of OM_PACKS) {
    packs[id] = { fresh: isFresh(id), exists: packExists(id) }
  }
  return {
    service: 'aether-om-cache',
    cacheDir: cacheRoot(),
    ttlSeconds: ttlSeconds(),
    base: omBaseUrl(),
    model: env('OPEN_METEO_MODEL') || 'best_match',
    source: env('OPEN_METEO_SOURCE', 'auto'),
    hasApiKey: Boolean(env('OPEN_METEO_API_KEY')),
    packs,
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  if (args.includes('--status') || args[0] === 'status' || !args.length) {
    console.log(JSON.stringify(statusPayloadOm(), null, 2))
    process.exit(0)
  }
  let pack = 'global/wind'
  const i = args.indexOf('--pack')
  if (i >= 0 && args[i + 1]) pack = args[i + 1]
  else if (args[0] && !args[0].startsWith('-')) pack = args[0]
  const result = await fetchAndWrite(pack)
  console.log(JSON.stringify(result, null, 2))
  if (result.ok) process.exit(0)
  if (result.fallback === 'demo') process.exit(2)
  process.exit(1)
}
