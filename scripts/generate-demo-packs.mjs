/**
 * 生成 public/demo 静态包 + /regional 暗色卫星 PMTiles。
 * 格式（唯一）：每包 meta.json + u.bin / v.bin（Float32 LE, row-major, south→north）
 * 可选 scalar.bin（f32）与 mask.bin（u8, 1=valid/ocean）。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demoRoot = path.join(root, 'public', 'demo')
const geoRoot = path.join(root, 'public', 'geo')
const landPath = path.join(geoRoot, 'ne_110m_land.geojson')
const oscarPath = path.join(demoRoot, 'source', 'oscar-ecs-clim.json')
const fireflyDir = path.join(root, 'public', 'basemap', 'regional')
const pmtilesPath = path.join(fireflyDir, 'firefly.pmtiles')
const fireflyMetaPath = path.join(fireflyDir, 'firefly.json')
const tileCache = path.join(fireflyDir, 'source')

const REGIONAL_BBOX = [117.5, 22.0, 131.5, 35.0]
const FIREFLY_BBOX = [116.5, 21.0, 132.5, 36.0]
const FIREFLY_MIN_Z = 5
const FIREFLY_MAX_Z = 10
const FIREFLY_ATTR = 'Esri, Maxar, Earthstar Geographics 等'
const FIREFLY_TILE =
  'https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile'

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function writeF32(file, arr) {
  fs.writeFileSync(file, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength))
}

function writeU8(file, arr) {
  fs.writeFileSync(file, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength))
}

function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function pointInPoly(x, y, geom) {
  if (!geom) return false
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  for (const poly of polys) {
    if (!poly[0] || !pointInRing(x, y, poly[0])) continue
    let hole = false
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(x, y, poly[h])) hole = true
    }
    if (!hole) return true
  }
  return false
}

function ringBBox(ring) {
  let w = 180,
    s = 90,
    e = -180,
    n = -90
  for (const p of ring) {
    if (p[0] < w) w = p[0]
    if (p[0] > e) e = p[0]
    if (p[1] < s) s = p[1]
    if (p[1] > n) n = p[1]
  }
  return [w, s, e, n]
}

function geomBBox(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  let w = 180,
    s = 90,
    e = -180,
    n = -90
  for (const poly of polys) {
    const b = ringBBox(poly[0] || [])
    if (b[0] < w) w = b[0]
    if (b[1] < s) s = b[1]
    if (b[2] > e) e = b[2]
    if (b[3] > n) n = b[3]
  }
  return [w, s, e, n]
}

function loadLand() {
  const g = JSON.parse(fs.readFileSync(landPath, 'utf8'))
  return g.features.map((f) => {
    const geom = f.geometry
    geom._bbox = geomBBox(geom)
    return geom
  })
}

function isLand(geoms, lon, lat) {
  for (const g of geoms) {
    const b = g._bbox
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue
    if (pointInPoly(lon, lat, g)) return true
  }
  return false
}

function cellLonLat(nx, ny, bbox, ix, iy) {
  const [w, s, e, n] = bbox
  const lon = nx === 1 ? (w + e) / 2 : w + (ix / (nx - 1)) * (e - w)
  const lat = ny === 1 ? (s + n) / 2 : s + (iy / (ny - 1)) * (n - s)
  return [lon, lat]
}

function pack(dir, { nx, ny, bbox, time, u, v, scalar, mask, vars, units, fill, kind, source }) {
  ensureDir(dir)
  const meta = {
    nx,
    ny,
    bbox,
    time,
    kind: kind ?? null,
    uFile: 'u.bin',
    vFile: 'v.bin',
    scalarFile: scalar ? 'scalar.bin' : null,
    maskFile: mask ? 'mask.bin' : null,
    meta: {
      source: source ?? 'demo',
      vars,
      units,
      fill: fill ?? 9999,
      rowOrder: 'south-north',
      endian: 'le',
      dtype: 'float32',
    },
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
  writeF32(path.join(dir, 'u.bin'), u)
  writeF32(path.join(dir, 'v.bin'), v)
  if (scalar) writeF32(path.join(dir, 'scalar.bin'), scalar)
  else {
    const stale = path.join(dir, 'scalar.bin')
    if (fs.existsSync(stale)) fs.unlinkSync(stale)
  }
  if (mask) writeU8(path.join(dir, 'mask.bin'), mask)
  else {
    const stale = path.join(dir, 'mask.bin')
    if (fs.existsSync(stale)) fs.unlinkSync(stale)
  }
}

function globalWind(nx, ny) {
  const bbox = [-180, -90, 180, 90]
  const u = new Float32Array(nx * ny)
  const v = new Float32Array(nx * ny)
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const [lon, lat] = cellLonLat(nx, ny, bbox, ix, iy)
      const jetN = 28 * Math.exp(-(((lat - 42) / 11) ** 2)) * (1 + 0.28 * Math.sin(((lon + lat) * Math.PI) / 28))
      const jetS = 22 * Math.exp(-(((lat + 38) / 12) ** 2))
      const trades = -9 * Math.exp(-((lat / 16) ** 2))
      const polar = -4 * Math.exp(-(((Math.abs(lat) - 75) / 8) ** 2))
      const uu = jetN + jetS + trades + polar + 2.2 * Math.sin((lon * Math.PI) / 90)
      const vv =
        3.4 * Math.sin(((lon + 2 * lat) * Math.PI) / 55) * Math.cos((lat * Math.PI) / 180) +
        1.6 * Math.sin((lon * Math.PI) / 40)
      const i = iy * nx + ix
      u[i] = uu
      v[i] = vv
    }
  }
  return { nx, ny, bbox, u, v }
}

function chinaWind(nx, ny) {
  const bbox = [73, 18, 135, 54]
  const u = new Float32Array(nx * ny)
  const v = new Float32Array(nx * ny)
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const [lon, lat] = cellLonLat(nx, ny, bbox, ix, iy)
      const jet = 18 * Math.exp(-(((lat - 32) / 9) ** 2))
      const monsoon = 6 * Math.sin(((lon - 100) * Math.PI) / 40) * Math.cos(((lat - 28) * Math.PI) / 30)
      const i = iy * nx + ix
      u[i] = jet * 0.35 + monsoon + 3 * Math.sin((lat * Math.PI) / 18)
      v[i] = 4.5 * Math.sin(((lon - 90) * Math.PI) / 25) + 2 * Math.cos((lat * Math.PI) / 16)
    }
  }
  return { nx, ny, bbox, u, v }
}

function bilinearOscar(src, lon, lat) {
  const { lons, lats, u, v, mask, nx, ny } = src
  const dx = lons[1] - lons[0]
  const dy = lats[1] - lats[0]
  if (lon < lons[0] - dx * 0.6 || lon > lons[nx - 1] + dx * 0.6 || lat < lats[0] - dy * 0.6 || lat > lats[ny - 1] + dy * 0.6) {
    return { u: Number.NaN, v: Number.NaN, m: 0 }
  }
  const x = (lon - lons[0]) / dx
  const y = (lat - lats[0]) / dy
  const x0 = Math.max(0, Math.min(nx - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(ny - 1, Math.floor(y)))
  const x1 = Math.min(nx - 1, x0 + 1)
  const y1 = Math.min(ny - 1, y0 + 1)
  const tx = Math.min(1, Math.max(0, x - x0))
  const ty = Math.min(1, Math.max(0, y - y0))
  const cell = (ix, iy) => {
    const i = iy * nx + ix
    if (!mask[i]) return null
    const uu = u[i]
    const vv = v[i]
    if (uu == null || vv == null || !Number.isFinite(uu) || !Number.isFinite(vv)) return null
    return [uu, vv]
  }
  const c00 = cell(x0, y0)
  const c10 = cell(x1, y0)
  const c01 = cell(x0, y1)
  const c11 = cell(x1, y1)
  const parts = [
    c00 ? [c00, (1 - tx) * (1 - ty)] : null,
    c10 ? [c10, tx * (1 - ty)] : null,
    c01 ? [c01, (1 - tx) * ty] : null,
    c11 ? [c11, tx * ty] : null,
  ].filter(Boolean)
  if (parts.length < 2) return { u: Number.NaN, v: Number.NaN, m: 0 }
  let wsum = 0
  let uu = 0
  let vv = 0
  for (const [c, w] of parts) {
    wsum += w
    uu += c[0] * w
    vv += c[1] * w
  }
  if (wsum < 0.2) return { u: Number.NaN, v: Number.NaN, m: 0 }
  return { u: uu / wsum, v: vv / wsum, m: 1 }
}

function regionalFromOscar(src, nx, ny, land) {
  const bbox = REGIONAL_BBOX
  const u = new Float32Array(nx * ny)
  const v = new Float32Array(nx * ny)
  const mask = new Uint8Array(nx * ny)
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const [lon, lat] = cellLonLat(nx, ny, bbox, ix, iy)
      const i = iy * nx + ix
      if (isLand(land, lon, lat)) {
        u[i] = Number.NaN
        v[i] = Number.NaN
        mask[i] = 0
        continue
      }
      const s = bilinearOscar(src, lon, lat)
      if (!s.m) {
        u[i] = Number.NaN
        v[i] = Number.NaN
        mask[i] = 0
        continue
      }
      u[i] = s.u
      v[i] = s.v
      mask[i] = 1
    }
  }
  return { nx, ny, bbox, u, v, mask }
}

function regionalTemp(base) {
  const scalar = new Float32Array(base.nx * base.ny)
  for (let iy = 0; iy < base.ny; iy++) {
    for (let ix = 0; ix < base.nx; ix++) {
      const [lon, lat] = cellLonLat(base.nx, base.ny, base.bbox, ix, iy)
      const i = iy * base.nx + ix
      scalar[i] = 28 - (lat - 22) * 0.55 + 1.4 * Math.sin(((lon - 120) * Math.PI) / 6)
    }
  }
  return { ...base, scalar }
}

function regionalPrecip(base) {
  const scalar = new Float32Array(base.nx * base.ny)
  for (let iy = 0; iy < base.ny; iy++) {
    for (let ix = 0; ix < base.nx; ix++) {
      const [lon, lat] = cellLonLat(base.nx, base.ny, base.bbox, ix, iy)
      const i = iy * base.nx + ix
      scalar[i] =
        18 * Math.exp(-(((lon - 121.2) ** 2 + (lat - 24.8) ** 2) / 3.2)) +
        11 * Math.exp(-(((lon - 126.0) ** 2 + (lat - 30.2) ** 2) / 4.5))
    }
  }
  return { ...base, scalar }
}

/* ---- PNG (procedural fallback) ---- */

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const crc = crc32(Buffer.concat([t, data]))
  const b = Buffer.alloc(12 + data.length)
  b.writeUInt32BE(data.length, 0)
  t.copy(b, 4)
  data.copy(b, 8)
  b.writeUInt32BE(crc, 8 + data.length)
  return b
}

function encodePngRgb(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[(width * 3 + 1) * y] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, (width * 3 + 1) * y + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}

function hashNoise(lon, lat) {
  const s = Math.sin(lon * 12.9898 + lat * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function lon2tile(lon, z) {
  return ((lon + 180) / 360) * 2 ** z
}

function lat2tile(lat, z) {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
}

function tilePixelLonLat(z, x, y, px, py, size) {
  const n = 2 ** z
  const lon = ((x + px / size) / n) * 360 - 180
  const mercY = (y + py / size) / n
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercY))) * 180) / Math.PI
  return [lon, lat]
}

function proceduralTile(land, z, x, y) {
  const size = 256
  const rgb = Buffer.alloc(size * size * 3)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [lon, lat] = tilePixelLonLat(z, x, y, px, py, size)
      const n = hashNoise(lon * 3.1, lat * 3.1)
      const n2 = hashNoise(lon * 9.7, lat * 8.3)
      const landCell = isLand(land, lon, lat)
      const i = (py * size + px) * 3
      if (landCell) {
        const shade = 0.55 + 0.45 * n
        rgb[i] = Math.max(0, Math.min(255, (14 + n2 * 10) * shade + 4))
        rgb[i + 1] = Math.max(0, Math.min(255, (28 + n2 * 14) * shade + 6))
        rgb[i + 2] = Math.max(0, Math.min(255, (44 + n2 * 12) * shade + 8))
      } else {
        rgb[i] = 5 + n * 5
        rgb[i + 1] = 10 + n * 8
        rgb[i + 2] = 20 + n * 10
      }
    }
  }
  return encodePngRgb(size, size, rgb)
}

/* ---- PMTiles v3 writer ---- */

function encodeVarint(n) {
  const bytes = []
  let x = BigInt(n)
  while (x >= 0x80n) {
    bytes.push(Number(x & 0x7fn) | 0x80)
    x >>= 7n
  }
  bytes.push(Number(x))
  return Buffer.from(bytes)
}

function rotateHilbert(n, xy, rx, ry) {
  if (ry === 0) {
    if (rx === 1) {
      xy[0] = n - 1 - xy[0]
      xy[1] = n - 1 - xy[1]
    }
    const t = xy[0]
    xy[0] = xy[1]
    xy[1] = t
  }
}

function zxyToTileId(z, x, y) {
  let acc = 0
  for (let a = 0; a < z; a++) acc += (1 << a) * (1 << a)
  let d = 0
  const xy = [x, y]
  let s = 1 << z
  while (s > 1) {
    s >>= 1
    const rx = (xy[0] & s) > 0 ? 1 : 0
    const ry = (xy[1] & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)
    rotateHilbert(s, xy, rx, ry)
  }
  return acc + d
}

function serializeDirectory(entries) {
  const parts = [encodeVarint(entries.length)]
  let lastId = 0
  for (const e of entries) {
    parts.push(encodeVarint(e.tileId - lastId))
    lastId = e.tileId
  }
  for (const e of entries) parts.push(encodeVarint(e.runLength))
  for (const e of entries) parts.push(encodeVarint(e.length))
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].offset === entries[i - 1].offset + entries[i - 1].length) {
      parts.push(encodeVarint(0))
    } else {
      parts.push(encodeVarint(entries[i].offset + 1))
    }
  }
  return Buffer.concat(parts)
}

function writeU64(buf, offset, n) {
  const x = BigInt(n)
  buf.writeUInt32LE(Number(x & 0xffffffffn), offset)
  buf.writeUInt32LE(Number(x >> 32n), offset + 4)
}

function buildPmtiles(tiles, bbox, tileType) {
  const entries = tiles
    .map((t) => ({ ...t, tileId: zxyToTileId(t.z, t.x, t.y) }))
    .sort((a, b) => a.tileId - b.tileId)
  const unique = []
  const seen = new Set()
  for (const e of entries) {
    if (seen.has(e.tileId)) continue
    seen.add(e.tileId)
    unique.push(e)
  }
  const HEADER_PAD = 16384
  const blobs = unique.map((e) => e.data)
  const data = Buffer.concat(blobs)
  let off = 0
  const dir = unique.map((e) => {
    const rec = { tileId: e.tileId, runLength: 1, length: e.data.length, offset: off }
    off += e.data.length
    return rec
  })
  const root = zlib.gzipSync(serializeDirectory(dir))
  const metadata = zlib.gzipSync(
    Buffer.from(
      JSON.stringify({
        name: 'firefly',
        description: 'Esri World Imagery Firefly crop for /regional (private demo cache)',
        format: tileType === 3 ? 'jpeg' : 'png',
        type: 'baselayer',
        bounds: bbox.join(','),
        minzoom: FIREFLY_MIN_Z,
        maxzoom: FIREFLY_MAX_Z,
        attribution: FIREFLY_ATTR,
      }),
    ),
  )
  const rootOff = 127
  const metaOff = rootOff + root.length
  if (metaOff + metadata.length > HEADER_PAD) {
    throw new Error(`root+meta ${metaOff + metadata.length} exceeds 16KB; need leaf directories`)
  }
  const header = Buffer.alloc(HEADER_PAD)
  header.write('PMTiles', 0)
  header[7] = 3
  writeU64(header, 8, rootOff)
  writeU64(header, 16, root.length)
  writeU64(header, 24, metaOff)
  writeU64(header, 32, metadata.length)
  writeU64(header, 40, 0)
  writeU64(header, 48, 0)
  writeU64(header, 56, HEADER_PAD)
  writeU64(header, 64, data.length)
  writeU64(header, 72, unique.length)
  writeU64(header, 80, unique.length)
  writeU64(header, 88, unique.length)
  header[96] = 1
  header[97] = 2
  header[98] = 1
  header[99] = tileType
  header[100] = FIREFLY_MIN_Z
  header[101] = FIREFLY_MAX_Z
  header.writeInt32LE(Math.round(bbox[0] * 1e7), 102)
  header.writeInt32LE(Math.round(bbox[1] * 1e7), 106)
  header.writeInt32LE(Math.round(bbox[2] * 1e7), 110)
  header.writeInt32LE(Math.round(bbox[3] * 1e7), 114)
  header[118] = 6
  header.writeInt32LE(Math.round(((bbox[0] + bbox[2]) / 2) * 1e7), 119)
  header.writeInt32LE(Math.round(((bbox[1] + bbox[3]) / 2) * 1e7), 123)
  root.copy(header, rootOff)
  metadata.copy(header, metaOff)
  return Buffer.concat([header, data])
}

function tileRange(z, bbox) {
  const [w, s, e, n] = bbox
  const max = 2 ** z - 1
  const x0 = Math.max(0, Math.floor(lon2tile(w, z)))
  const x1 = Math.min(max, Math.floor(lon2tile(e - 1e-9, z)))
  const y0 = Math.max(0, Math.floor(lat2tile(n, z)))
  const y1 = Math.min(max, Math.floor(lat2tile(s + 1e-9, z)))
  const out = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) out.push({ z, x, y })
  }
  return out
}

async function fetchFireflyTile(z, x, y) {
  const cached = path.join(tileCache, `${z}`, `${x}`, `${y}.jpg`)
  if (fs.existsSync(cached) && fs.statSync(cached).size > 800) {
    return fs.readFileSync(cached)
  }
  const url = `${FIREFLY_TILE}/${z}/${y}/${x}`
  const res = await fetch(url, { headers: { 'User-Agent': 'aether-demo-shell/0.1 (private demo bake)' } })
  if (!res.ok) throw new Error(`firefly ${z}/${x}/${y} ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 400) throw new Error('tiny tile')
  ensureDir(path.dirname(cached))
  fs.writeFileSync(cached, buf)
  return buf
}

async function poolMap(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

function writeFireflyJson() {
  ensureDir(fireflyDir)
  const meta = {
    name: 'firefly',
    source: 'Esri World Imagery Firefly',
    tiles: `${FIREFLY_TILE}/{z}/{y}/{x}`,
    bbox: FIREFLY_BBOX,
    minzoom: FIREFLY_MIN_Z,
    maxzoom: FIREFLY_MAX_Z,
    prefetch: [6, 7, 8],
    path: '/basemap/regional/firefly.pmtiles',
    opsPath: '/opt/aether-demo-shell/public/basemap/regional/firefly.pmtiles',
    attribution: FIREFLY_ATTR,
    tos: '批量离线烘焙进仓或公网分发可能违 Esri ToS。演示机私有本地缓存（本文件旁 firefly.pmtiles，gitignore）。生产直连备 Esri key，密钥不进仓。',
    note: 'pnpm generate 在演示机烘焙。缺档时区域页仍走墨蓝矢量，不拉公网大图。',
  }
  fs.writeFileSync(fireflyMetaPath, JSON.stringify(meta, null, 2) + '\n')
}

async function buildRegionalBasemap(land) {
  writeFireflyJson()
  if (fs.existsSync(pmtilesPath) && fs.statSync(pmtilesPath).size > 80_000 && process.env.FORCE_BASEMAP !== '1') {
    console.log('firefly.pmtiles exists, skip (FORCE_BASEMAP=1 to rebuild)')
    return
  }
  const zooms = []
  for (let z = FIREFLY_MIN_Z; z <= FIREFLY_MAX_Z; z++) zooms.push(z)
  const coords = zooms.flatMap((z) => tileRange(z, FIREFLY_BBOX))
  console.log('Firefly tiles', coords.length, 'bbox', FIREFLY_BBOX.join(','), 'z', FIREFLY_MIN_Z, '-', FIREFLY_MAX_Z)
  let jpegOk = 0
  const fetched = await poolMap(coords, 12, async (c) => {
    try {
      const data = await fetchFireflyTile(c.z, c.x, c.y)
      jpegOk++
      return { ...c, data, ok: true }
    } catch {
      return { ...c, data: null, ok: false }
    }
  })
  const useJpeg = jpegOk / coords.length >= 0.8
  const tiles = fetched.map((t) => {
    if (useJpeg && t.ok) return { z: t.z, x: t.x, y: t.y, data: t.data }
    return { z: t.z, x: t.x, y: t.y, data: proceduralTile(land, t.z, t.x, t.y) }
  })
  const buf = buildPmtiles(tiles, FIREFLY_BBOX, useJpeg ? 3 : 2)
  fs.writeFileSync(pmtilesPath, buf)
  console.log('wrote', pmtilesPath, buf.length, useJpeg ? 'jpeg-firefly' : 'png-hillshade', 'ok', jpegOk, '/', coords.length)
}

/* ---- minimal classic NetCDF-3 writer (CDF-1) ---- */

function pad4(n) {
  return (4 - (n % 4)) % 4
}

class NcBuf {
  constructor() {
    this.parts = []
  }
  u32(n) {
    const b = Buffer.alloc(4)
    b.writeUInt32BE(n >>> 0, 0)
    this.parts.push(b)
  }
  i32(n) {
    const b = Buffer.alloc(4)
    b.writeInt32BE(n, 0)
    this.parts.push(b)
  }
  f32s(arr) {
    const b = Buffer.alloc(arr.length * 4)
    for (let i = 0; i < arr.length; i++) b.writeFloatBE(arr[i], i * 4)
    this.parts.push(b)
  }
  name(s) {
    const raw = Buffer.from(s, 'ascii')
    this.u32(raw.length)
    this.parts.push(raw)
    const p = pad4(raw.length)
    if (p) this.parts.push(Buffer.alloc(p))
  }
  concat() {
    return Buffer.concat(this.parts)
  }
  get length() {
    return this.parts.reduce((n, p) => n + p.length, 0)
  }
}

function writeClassicNc(file, { nx, ny, bbox, u, v }) {
  const lon = new Float32Array(nx)
  const lat = new Float32Array(ny)
  for (let i = 0; i < nx; i++) lon[i] = nx === 1 ? (bbox[0] + bbox[2]) / 2 : bbox[0] + (i / (nx - 1)) * (bbox[2] - bbox[0])
  for (let j = 0; j < ny; j++) lat[j] = ny === 1 ? (bbox[1] + bbox[3]) / 2 : bbox[1] + (j / (ny - 1)) * (bbox[3] - bbox[1])

  const NC_FLOAT = 5
  const NC_CHAR = 2
  const NC_DIMENSION = 10
  const NC_VARIABLE = 11
  const NC_ATTRIBUTE = 12

  const header = new NcBuf()
  header.parts.push(Buffer.from([0x43, 0x44, 0x46, 0x01]))
  header.u32(0)
  header.u32(NC_DIMENSION)
  header.u32(2)
  header.name('lat')
  header.u32(ny)
  header.name('lon')
  header.u32(nx)
  header.u32(0)
  header.u32(0)

  const vars = [
    { name: 'lat', dims: [0], data: lat, units: 'degrees_north' },
    { name: 'lon', dims: [1], data: lon, units: 'degrees_east' },
    { name: 'uo', dims: [0, 1], data: u, units: 'm/s' },
    { name: 'vo', dims: [0, 1], data: v, units: 'm/s' },
  ]

  const vsize = vars.map((vr) => {
    const n = vr.data.length * 4
    return n + pad4(n)
  })

  const varSection = new NcBuf()
  varSection.u32(NC_VARIABLE)
  varSection.u32(vars.length)
  for (const vr of vars) {
    varSection.name(vr.name)
    varSection.u32(vr.dims.length)
    for (const d of vr.dims) varSection.u32(d)
    varSection.u32(NC_ATTRIBUTE)
    varSection.u32(1)
    varSection.name('units')
    varSection.u32(NC_CHAR)
    const ub = Buffer.from(vr.units, 'ascii')
    varSection.u32(ub.length)
    varSection.parts.push(ub)
    const p = pad4(ub.length)
    if (p) varSection.parts.push(Buffer.alloc(p))
    varSection.u32(NC_FLOAT)
    varSection.u32(vr.data.length * 4)
    varSection.u32(0)
  }

  const beginOffsetPositions = []
  const assembledVars = varSection.concat()
  {
    let cursor = 0
    const view = assembledVars
    cursor += 8
    for (let vi = 0; vi < vars.length; vi++) {
      const nameLen = view.readUInt32BE(cursor)
      cursor += 4 + nameLen + pad4(nameLen)
      const nd = view.readUInt32BE(cursor)
      cursor += 4 + nd * 4
      const tag = view.readUInt32BE(cursor)
      cursor += 4
      const na = view.readUInt32BE(cursor)
      cursor += 4
      if (tag === NC_ATTRIBUTE) {
        for (let a = 0; a < na; a++) {
          const nl = view.readUInt32BE(cursor)
          cursor += 4 + nl + pad4(nl)
          cursor += 4
          const ne = view.readUInt32BE(cursor)
          cursor += 4 + ne + pad4(ne)
        }
      } else {
        cursor -= 4
      }
      cursor += 8
      beginOffsetPositions.push(cursor)
      cursor += 4
    }
  }

  const headerLen = header.length + assembledVars.length
  let off = headerLen
  const begins = []
  for (let i = 0; i < vars.length; i++) {
    begins.push(off)
    off += vsize[i]
  }
  for (let i = 0; i < begins.length; i++) {
    assembledVars.writeUInt32BE(begins[i], beginOffsetPositions[i])
  }

  const dataParts = []
  for (let i = 0; i < vars.length; i++) {
    const b = Buffer.alloc(vsize[i])
    for (let k = 0; k < vars[i].data.length; k++) {
      const val = vars[i].data[k]
      b.writeFloatBE(Number.isFinite(val) ? val : 9999, k * 4)
    }
    dataParts.push(b)
  }

  fs.writeFileSync(file, Buffer.concat([header.concat(), assembledVars, ...dataParts]))
}

const land = loadLand()
const now = '2026-10-21T00:00:00Z'
if (!fs.existsSync(oscarPath)) {
  throw new Error(`missing OSCAR clim ${oscarPath}`)
}
const oscar = JSON.parse(fs.readFileSync(oscarPath, 'utf8'))

ensureDir(demoRoot)

const gw = globalWind(721, 361)
pack(path.join(demoRoot, 'global', 'wind'), {
  ...gw,
  time: now,
  kind: 'wind',
  vars: ['u', 'v'],
  units: 'm/s',
})

const cw = chinaWind(249, 145)
pack(path.join(demoRoot, 'forecast', 'china'), {
  ...cw,
  time: now,
  kind: 'wind',
  vars: ['u', 'v'],
  units: 'm/s',
})

const rc = regionalFromOscar(oscar, 141, 131, land)
{
  let ocean = 0
  let landCells = 0
  for (let i = 0; i < rc.mask.length; i++) {
    if (rc.mask[i]) ocean++
    else landCells++
  }
  if (!landCells || ocean < 8) {
    throw new Error(`regional/currents 陆地无有效格检查失败 ocean=${ocean} land=${landCells}`)
  }
  console.log('regional currents', rc.nx, 'x', rc.ny, 'ocean', ocean, 'land', landCells)
}
pack(path.join(demoRoot, 'regional', 'currents'), {
  ...rc,
  time: oscar.times?.[0] ?? now,
  kind: 'ocean',
  vars: ['uo', 'vo'],
  units: 'm/s',
  source: 'demo-oscar-clim',
})

const rt = regionalTemp(rc)
pack(path.join(demoRoot, 'regional', 'temp'), {
  nx: rt.nx,
  ny: rt.ny,
  bbox: rt.bbox,
  u: rt.u,
  v: rt.v,
  scalar: rt.scalar,
  mask: rt.mask,
  time: now,
  kind: 'temp',
  vars: ['sst'],
  units: 'degC',
})

const rp = regionalPrecip(rc)
pack(path.join(demoRoot, 'regional', 'precip'), {
  nx: rp.nx,
  ny: rp.ny,
  bbox: rp.bbox,
  u: rp.u,
  v: rp.v,
  scalar: rp.scalar,
  mask: rp.mask,
  time: now,
  kind: 'precip',
  vars: ['precip'],
  units: 'mm',
})

const sampleNx = 40
const sampleNy = 28
const sample = regionalFromOscar(oscar, sampleNx, sampleNy, land)
writeClassicNc(path.join(demoRoot, 'sample-currents.nc'), {
  nx: sampleNx,
  ny: sampleNy,
  bbox: sample.bbox,
  u: sample.u,
  v: sample.v,
})

fs.writeFileSync(
  path.join(demoRoot, 'README.md'),
  `# Demo 静态包格式（唯一）

每个子目录一份场：

- \`meta.json\`
- \`u.bin\` / \`v.bin\`：Float32 little-endian，长度 \`nx*ny\`
- 行主序 **south → north**，列 west → east
- 可选 \`scalar.bin\`（同形状 f32）、\`mask.bin\`（Uint8，1=有效/海洋，0=陆地）

禁止把私有 JSON 直接喂给粒子层。前端只认 FieldFrame。

| 包 | 用途 |
|----|------|
| global/wind | 全球风雾 ~0.5°（721×361） |
| forecast/china | 预报台全国 ≥0.25°（249×145） |
| regional/currents | 区域场洋流：OSCAR 1/3° 气候态重采样 + 硬海洋 mask（示例数据） |
| regional/temp | 气温热幕 scalar |
| regional/precip | 降雨积水斑 scalar |
| sample-currents.nc | NetCDF-3 上传试验（变量 uo/vo） |

区域底图 \`public/basemap/regional/firefly.pmtiles\`（gitignore，演示机私有缓存）锁 Firefly 窗 \`[116.5,21,132.5,36]\`，仅 \`/regional\` 使用。
`,
)

await buildRegionalBasemap(land)

console.log('demo packs written under public/demo')
console.log(' sample nc bytes', fs.statSync(path.join(demoRoot, 'sample-currents.nc')).size)
console.log(' china', cw.nx, 'x', cw.ny, 'global', gw.nx, 'x', gw.ny)
