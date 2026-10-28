import {
  inferKind,
  uvRange,
  scalarRange,
  speedPercentileRange,
  unitInterval,
  type FieldFrame,
  type FieldKind,
} from '@aether/field'
import { PARTICLE_TEX, visualCount, type LodLevel } from './lod'
import { CURTAIN_ALPHA, lutForKind, lutRangeForKind } from './lut'
import { fieldViewUv } from './view-uv'
import {
  BLIT_FS,
  DRAW_FS,
  DRAW_VS,
  FADE_FS,
  LINE_FS,
  LINE_VS,
  QUAD_GEO_VS,
  QUAD_VS,
  SCALAR_FS,
  UPDATE_FS,
  makeDrawVS,
  makeLineVS,
  makeQuadGeoVS,
} from './shaders'

export type PoolId = 'wind' | 'currents'
/** wind = |UV| speed curtain from the same pack; never a second (temp) pack. */
export type OverlayMode = 'none' | 'wind' | 'temp' | 'precip' | 'ocean'
export type FieldStyle = 'wind-fog' | 'currents'

type GL = WebGL2RenderingContext

function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader: ${info}`)
  }
  return sh
}

function program(gl: GL, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(p)}`)
  }
  return p
}

function createRgbaTex(gl: GL, w: number, h: number, data: Uint8Array | null, filter: number): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  return t
}

function seedParticles(
  w: number,
  h: number,
  view: [number, number, number, number] = [0, 0, 1, 1],
): Uint8Array {
  const [u0, v0, u1, v1] = view
  const du = Math.max(0.001, u1 - u0)
  const dv = Math.max(0.001, v1 - v0)
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const x = Math.min(0.999, u0 + Math.random() * du)
    const y = Math.min(0.999, v0 + Math.random() * dv)
    const bx = Math.min(254, Math.floor(x * 255))
    const by = Math.min(254, Math.floor(y * 255))
    const i4 = i * 4
    data[i4] = Math.round((x * 255 - bx) * 255)
    data[i4 + 1] = Math.round((y * 255 - by) * 255)
    data[i4 + 2] = bx
    data[i4 + 3] = by
  }
  return data
}

/**
 * 硬海 mask 岸线软 1 格（约 2–4px @ 区域窗）。仅 ocean。
 * 契约 mask 是 1=海/0=陆；GPU 蓝通道必须是 0–255。若把 0/1 原样写入字节，
 * shader `v_alive < 0.45` 会把全部海点当陆地丢掉，地球空转。
 */
function softenOceanMask(mask: Uint8Array, nx: number, ny: number): Uint8Array {
  const out = new Uint8Array(nx * ny)
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      let s = 0
      let c = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy
          const xx = x + dx
          if (yy < 0 || yy >= ny || xx < 0 || xx >= nx) continue
          s += mask[yy * nx + xx] > 0 ? 1 : 0
          c++
        }
      }
      out[y * nx + x] = Math.round((s / Math.max(1, c)) * 255)
    }
  }
  return out
}

function fieldToRgba(frame: FieldFrame): {
  data: Uint8Array
  uMin: number
  uMax: number
  vMin: number
  vMax: number
  speedLo: number
  speedHi: number
} {
  const kind = inferKind(frame)
  const oceanMask = kind === 'ocean'
  const { u: ur, v: vr } = uvRange(frame)
  const sr = scalarRange(frame)
  const n = frame.nx * frame.ny
  const data = new Uint8Array(n * 4)
  const uSpan = ur[1] - ur[0] || 1
  const vSpan = vr[1] - vr[0] || 1
  const sSpan = sr[1] - sr[0] || 1
  const lutRange = lutRangeForKind(kind)
  const [speedLo, speedHi] = kind === 'ocean' ? speedPercentileRange(frame) : lutRange
  const soft = oceanMask && frame.mask ? softenOceanMask(frame.mask, frame.nx, frame.ny) : null
  for (let i = 0; i < n; i++) {
    const i4 = i * 4
    const u = frame.u[i]
    const v = frame.v[i]
    const finite = Number.isFinite(u) && Number.isFinite(v)
    let aliveByte = 255
    if (oceanMask) {
      const m = soft ? soft[i] : frame.mask ? (frame.mask[i] > 0 ? 255 : 0) : 255
      aliveByte = finite ? m : 0
    } else if (kind === 'wind') {
      aliveByte = finite ? 255 : 0
    }
    data[i4] = finite ? Math.max(0, Math.min(255, Math.round(((u - ur[0]) / uSpan) * 255))) : 0
    data[i4 + 1] = finite ? Math.max(0, Math.min(255, Math.round(((v - vr[0]) / vSpan) * 255))) : 0
    let packedScalar = 0
    if (kind === 'wind') {
      packedScalar = finite ? unitInterval(Math.hypot(u, v), lutRange[0], lutRange[1]) : 0
    } else if (kind === 'ocean') {
      packedScalar = finite ? unitInterval(Math.hypot(u, v), speedLo, speedHi) : 0
    } else if (frame.scalar) {
      const s = frame.scalar[i]
      const ok = Number.isFinite(s)
      packedScalar = ok ? unitInterval(s, lutRange[0], lutRange[1]) : 0
      if (!ok) aliveByte = 0
    } else {
      packedScalar = finite ? Math.hypot(u, v) / 20 : 0
    }
    data[i4 + 2] = aliveByte
    data[i4 + 3] = Math.max(0, Math.min(255, Math.round(packedScalar * 255)))
  }
  if (oceanMask) {
    let maxAlive = 0
    for (let i = 0; i < n; i++) {
      const b = data[i * 4 + 2]
      if (b > maxAlive) maxAlive = b
    }
    if (maxAlive < 115) {
      console.warn('[aether] ocean GPU mask byte too low', maxAlive, '— sea would discard')
    }
  }
  return { data, uMin: ur[0], uMax: ur[1], vMin: vr[0], vMax: vr[1], speedLo, speedHi }
}

/**
 * Ventusky / Windy visual grammar (own FieldFrame, no third-party tiles):
 * translucent color wash + white screen-space fade trails (webgl-wind).
 * LINEAR trail + fade≈0.995 turns 1px stamps into long silk; high drop / idle reseed = 乱窜.
 */
export const ADVECT_STEP = 0.0024
/** Spec: 全球/大范围 0.18，区域放大 0.09。 */
export const WIND_SPEED_GLOBAL = 0.18
export const WIND_SPEED_DESK = 0.09
export const TRAIL_FADE = 0.995
export const TRAIL_GAIN = 0.62
/** Screen pixels per frame at |vel| = speedRef (global 0.18). Desk scales with 0.09/0.18. */
export const TRAIL_TARGET_PX = 1.15
export const OCEAN_TARGET_PX = 1.05
/** @deprecated 用 WIND_SPEED_DESK / WIND_SPEED_GLOBAL */
export const WIND_DESK_SPEED_SCALE = WIND_SPEED_DESK / WIND_SPEED_GLOBAL

export function kindCode(kind: FieldKind): number {
  if (kind === 'ocean') return 1
  if (kind === 'temp') return 2
  if (kind === 'precip') return 3
  return 0
}

export const KIND_LOOK: Record<
  FieldKind,
  {
    style: FieldStyle
    overlay: OverlayMode
    speed: number
    drop: number
    size: number
    color: [number, number, number, number]
    ribbonDeg: number
    ribbonPx: number
    uvScale: number
    pool: PoolId
  }
> = {
  wind: {
    style: 'wind-fog',
    overlay: 'wind',
    speed: WIND_SPEED_GLOBAL,
    drop: 0.018,
    size: 1.45,
    color: [0.91, 0.957, 0.969, 0.38],
    ribbonDeg: 5.8,
    ribbonPx: 0.72,
    uvScale: 1,
    pool: 'wind',
  },
  ocean: {
    style: 'currents',
    overlay: 'ocean',
    speed: 0.11,
    drop: 0.012,
    size: 1.45,
    color: [0.85, 0.94, 0.96, 0.42],
    ribbonDeg: 3.2,
    ribbonPx: 7.2,
    uvScale: 1,
    pool: 'currents',
  },
  temp: {
    style: 'wind-fog',
    overlay: 'temp',
    speed: 0,
    drop: 0.0016,
    size: 1.35,
    color: [0.9, 0.82, 0.7, 0.1],
    ribbonDeg: 1.35,
    ribbonPx: 1.05,
    uvScale: 0,
    pool: 'currents',
  },
  precip: {
    style: 'currents',
    overlay: 'precip',
    speed: 0,
    drop: 0.0016,
    size: 1.25,
    color: [0.91, 0.957, 0.969, 0],
    ribbonDeg: 1.15,
    ribbonPx: 1.35,
    uvScale: 0,
    pool: 'wind',
  },
}

export type ParticleLayerOptions = {
  id?: string
}

/**
 * MapLibre CustomLayer：GPU 粒子。
 * - 粒子 UV 只活在 FieldFrame.bbox 内；每帧用当前相机 defaultProjectionData 重绑，禁止缓存 world→UV。
 * - 空闲 peak≈40 万；拖动停平流、计数不砍；松手 peak + 重投。
 * - wind：半透明 |UV| 色幕 + 白色点进屏空间拖影（Ventusky/Windy 语法）。
 * - temp：半透明热幕，无粒子。
 * - precip：湿处半透明 + 下落雨丝。
 * - ocean：半透明海幕 + 青色拖影。
 * - 粒子只活在相机可见 UV 窗。拖动清空拖影，禁止拖花。
 */
export class ParticleLayer {
  id: string
  type = 'custom' as const
  renderingMode = '2d' as const

  private map: import('maplibre-gl').Map | null = null
  private gl: GL | null = null
  private updateProg: WebGLProgram | null = null
  private drawProg: WebGLProgram | null = null
  private lineProg: WebGLProgram | null = null
  private scalarProg: WebGLProgram | null = null
  private fadeProg: WebGLProgram | null = null
  private blitProg: WebGLProgram | null = null
  private trail0: WebGLTexture | null = null
  private trail1: WebGLTexture | null = null
  private trailFbo: WebGLFramebuffer | null = null
  private lutTex: WebGLTexture | null = null
  private trailW = 0
  private trailH = 0
  private vao: WebGLVertexArrayObject | null = null
  private quadBuf: WebGLBuffer | null = null
  private ptex0: WebGLTexture | null = null
  private ptex1: WebGLTexture | null = null
  private fbo: WebGLFramebuffer | null = null
  private windTex: WebGLTexture | null = null
  /** 场窗：只来自 FieldFrame.bbox，相机不得改写。 */
  private bbox: [number, number, number, number] = [-180, -90, 180, 90]
  private uMin = -10
  private uMax = 10
  private vMin = -10
  private vMax = 10
  private speedRef = 12
  private lod: LodLevel = 'peak'
  private wrap = 1
  private viewUv: [number, number, number, number] = [0, 0, 1, 1]
  private style: FieldStyle = 'wind-fog'
  private overlay: OverlayMode = 'none'
  private kind: FieldKind = 'wind'
  private pool: PoolId = 'wind'
  private speed = KIND_LOOK.wind.speed
  private speedMul = 1
  private uvScale = 1
  private size = KIND_LOOK.wind.size
  private color: [number, number, number, number] = KIND_LOOK.wind.color
  private drop = KIND_LOOK.wind.drop
  private density = 0.42
  private ribbonDeg = KIND_LOOK.wind.ribbonDeg
  private ribbonPx = KIND_LOOK.wind.ribbonPx
  private advecting = true
  private hasFrame = false
  private pendingReseed = false
  private didPrerender = false
  private shaderVariant = ''
  private proj: ProjectionPack | null = null
  private moveHandler?: () => void
  private idleHandler?: () => void

  constructor(opts: ParticleLayerOptions = {}) {
    this.id = opts.id ?? 'aether-particles'
  }

  onAdd(map: import('maplibre-gl').Map, gl: WebGLRenderingContext) {
    this.map = map
    this.gl = gl as GL
    const g = this.gl
    this.vao = g.createVertexArray()
    this.updateProg = program(g, QUAD_VS, UPDATE_FS)
    this.drawProg = program(g, DRAW_VS, DRAW_FS)
    this.lineProg = program(g, LINE_VS, LINE_FS)
    this.scalarProg = program(g, QUAD_GEO_VS, SCALAR_FS)
    this.fadeProg = program(g, QUAD_VS, FADE_FS)
    this.blitProg = program(g, QUAD_VS, BLIT_FS)
    this.lutTex = createRgbaTex(g, 256, 1, lutForKind('wind'), g.LINEAR)
    this.trailFbo = g.createFramebuffer()
    this.quadBuf = g.createBuffer()
    g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf)
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)

    const seed = seedParticles(PARTICLE_TEX.width, PARTICLE_TEX.height)
    this.ptex0 = createRgbaTex(g, PARTICLE_TEX.width, PARTICLE_TEX.height, seed, g.NEAREST)
    this.ptex1 = createRgbaTex(g, PARTICLE_TEX.width, PARTICLE_TEX.height, seed, g.NEAREST)
    this.fbo = g.createFramebuffer()
    this.windTex = createRgbaTex(
      g,
      2,
      2,
      new Uint8Array([128, 128, 255, 0, 128, 128, 255, 0, 128, 128, 255, 0, 128, 128, 255, 0]),
      g.LINEAR,
    )

    this.moveHandler = () => {
      this.advecting = false
      if (this.lod === 'interact' || this.lod === 'paused') this.lod = 'peak'
      this.clearTrail()
      map.triggerRepaint()
    }
    this.idleHandler = () => {
      this.advecting = true
      this.lod = 'peak'
      // Do not reseed on idle — teleporting the pool is what reads as 乱窜.
      map.triggerRepaint()
    }
    map.on('movestart', this.moveHandler)
    map.on('zoomstart', this.moveHandler)
    map.on('moveend', this.idleHandler)
    map.on('zoomend', this.idleHandler)
  }

  onRemove() {
    const map = this.map
    if (map && this.moveHandler) {
      map.off('movestart', this.moveHandler)
      map.off('zoomstart', this.moveHandler)
    }
    if (map && this.idleHandler) {
      map.off('moveend', this.idleHandler)
      map.off('zoomend', this.idleHandler)
    }
    const g = this.gl
    if (g) {
      g.deleteProgram(this.updateProg)
      g.deleteProgram(this.drawProg)
      g.deleteProgram(this.lineProg)
      g.deleteProgram(this.scalarProg)
      g.deleteProgram(this.fadeProg)
      g.deleteProgram(this.blitProg)
      g.deleteBuffer(this.quadBuf)
      g.deleteVertexArray(this.vao)
      g.deleteTexture(this.ptex0)
      g.deleteTexture(this.ptex1)
      g.deleteTexture(this.windTex)
      g.deleteTexture(this.trail0)
      g.deleteTexture(this.trail1)
      g.deleteTexture(this.lutTex)
      g.deleteFramebuffer(this.fbo)
      g.deleteFramebuffer(this.trailFbo)
    }
    this.map = null
    this.gl = null
  }

  setLod(level: LodLevel) {
    if (this.kind === 'temp' || this.kind === 'precip') {
      this.advecting = false
      this.lod = 'paused'
      this.map?.triggerRepaint()
      return
    }
    if (level === 'paused') {
      this.advecting = false
      this.map?.triggerRepaint()
      return
    }
    if (level === 'interact') {
      this.lod = 'peak'
      this.map?.triggerRepaint()
      return
    }
    this.lod = level
    this.map?.triggerRepaint()
  }

  getLod(): LodLevel {
    return this.advecting ? this.lod : this.lod
  }

  pause() {
    this.advecting = false
    this.map?.triggerRepaint()
  }

  resume() {
    if (this.kind === 'temp' || this.kind === 'precip') {
      this.advecting = false
      this.lod = 'paused'
      this.map?.triggerRepaint()
      return
    }
    this.advecting = true
    this.lod = 'peak'
    this.map?.triggerRepaint()
  }

  setDensity(v: number) {
    this.density = v
    this.map?.triggerRepaint()
  }

  applyKindLook(kind: FieldKind) {
    const look = KIND_LOOK[kind]
    this.kind = kind
    this.style = look.style
    this.overlay = look.overlay
    this.speed = look.speed
    this.drop = look.drop
    this.size = look.size
    this.color = look.color
    this.ribbonDeg = look.ribbonDeg
    this.ribbonPx = look.ribbonPx
    this.uvScale = look.uvScale
    this.pool = look.pool
    this.uploadLut(kind)
    this.clearTrail()
    const lonSpan = Math.abs(this.bbox[2] - this.bbox[0])
    this.wrap = lonSpan > 350 ? 1 : 0
    this.syncViewWindow()
    this.syncRibbonFromView()
    if (kind === 'temp' || kind === 'precip') {
      this.advecting = false
      this.lod = 'paused'
    } else if (this.lod === 'paused') {
      this.advecting = true
      this.lod = 'peak'
    }
    this.map?.triggerRepaint()
  }

  setStyle(style: FieldStyle) {
    this.applyKindLook(style === 'currents' ? 'ocean' : 'wind')
  }

  setOverlay(mode: OverlayMode) {
    if (mode === 'none') {
      if (this.kind === 'temp' || this.kind === 'precip') this.applyKindLook(this.pool === 'currents' ? 'ocean' : 'wind')
      else this.map?.triggerRepaint()
      return
    }
    this.applyKindLook(mode)
  }

  setSpeed(v: number) {
    this.speedMul = v
  }

  setSize(v: number) {
    this.size = v
    this.map?.triggerRepaint()
  }

  getPool(): PoolId {
    return this.pool
  }

  showParticles(): boolean {
    return this.kind === 'wind' || this.kind === 'ocean'
  }

  drawCount(): number {
    if (!this.showParticles()) return 0
    return visualCount({
      ocean: this.kind === 'ocean',
      precip: this.kind === 'precip',
      regionalWindow: this.wrap < 0.5,
      density: this.density,
      zoom: this.map?.getZoom() ?? 1.35,
    })
  }

  setFrame(frame: FieldFrame | null) {
    const g = this.gl
    if (!g || !this.windTex || !frame) {
      this.hasFrame = false
      return
    }
    this.bbox = [frame.bbox[0], frame.bbox[1], frame.bbox[2], frame.bbox[3]]
    this.applyKind(frame)
    const packed = fieldToRgba(frame)
    this.uMin = packed.uMin
    this.uMax = packed.uMax
    this.vMin = packed.vMin
    this.vMax = packed.vMax
    this.speedRef = Math.max(0.4, packed.speedHi - packed.speedLo)
    g.bindTexture(g.TEXTURE_2D, this.windTex)
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, frame.nx, frame.ny, 0, g.RGBA, g.UNSIGNED_BYTE, packed.data)
    this.reseed(g)
    this.clearTrail()
    this.hasFrame = true
    this.map?.triggerRepaint()
  }

  /** 离屏平流：不碰 MapLibre 主 FBO。 */
  prerender(_gl: WebGLRenderingContext, args: unknown) {
    const g = this.gl
    if (!g || !this.hasFrame) return
    this.captureProj(args)
    this.syncViewWindow()
    this.syncRibbonFromView()
    if (this.pendingReseed) {
      this.reseed(g)
      this.pendingReseed = false
    }
    if (this.showParticles() && this.advecting && !this.map?.isMoving()) {
      this.updateParticles(g)
    }
    this.didPrerender = true
  }

  render(_gl: WebGLRenderingContext, args: unknown) {
    const g = this.gl
    if (!g || !this.hasFrame) return
    this.captureProj(args)
    this.syncViewWindow()
    this.syncRibbonFromView()
    if (!this.drawProg) return
    const matrix = this.proj?.mainMatrix
    if (!matrix) return

    if (this.pendingReseed) {
      this.reseed(g)
      this.pendingReseed = false
    }
    const moving = !!this.map?.isMoving()
    if (this.showParticles() && !moving) this.advecting = true
    if (!this.didPrerender && this.showParticles() && this.advecting && !moving) {
      this.updateParticles(g)
    }
    this.didPrerender = false

    const prevVao = g.getParameter(g.VERTEX_ARRAY_BINDING)
    const prevProg = g.getParameter(g.CURRENT_PROGRAM)
    const prevActive = g.getParameter(g.ACTIVE_TEXTURE)
    const prevTex = g.getParameter(g.TEXTURE_BINDING_2D)
    const prevFb = g.getParameter(g.FRAMEBUFFER_BINDING)
    const prevVp = g.getParameter(g.VIEWPORT) as Int32Array
    const blend = g.isEnabled(g.BLEND)
    const depth = g.isEnabled(g.DEPTH_TEST)

    if (this.vao) g.bindVertexArray(this.vao)

    // Stack: basemap → translucent curtain → screen-space trails / rain → labels.
    if (this.overlay !== 'none' && this.scalarProg) {
      g.bindFramebuffer(g.FRAMEBUFFER, prevFb)
      g.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3])
      this.drawScalar(g, matrix)
    }

    const particlesOn = this.showParticles()
    const count = particlesOn ? this.drawCount() : 0
    if (particlesOn && count > 0) {
      this.stampTrail(g, matrix, count, prevFb, prevVp)
      g.bindFramebuffer(g.FRAMEBUFFER, prevFb)
      g.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3])
      this.blitTrail(g)
    }

    if (prevVao) g.bindVertexArray(prevVao)
    else g.bindVertexArray(null)
    g.useProgram(prevProg)
    g.activeTexture(prevActive)
    g.bindTexture(g.TEXTURE_2D, prevTex)
    g.bindFramebuffer(g.FRAMEBUFFER, prevFb)
    g.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3])
    g.bindBuffer(g.ARRAY_BUFFER, null)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    if (!blend) g.disable(g.BLEND)
    if (depth) g.enable(g.DEPTH_TEST)
    else g.disable(g.DEPTH_TEST)

    if (this.map && !this.map.isMoving()) {
      this.map.triggerRepaint()
    }
  }

  private applyKind(frame: FieldFrame) {
    this.applyKindLook(inferKind(frame))
  }

  private uploadLut(kind: FieldKind) {
    const g = this.gl
    if (!g || !this.lutTex) return
    g.bindTexture(g.TEXTURE_2D, this.lutTex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 256, 1, 0, g.RGBA, g.UNSIGNED_BYTE, lutForKind(kind))
  }

  /** UV delta that moves a p95 particle ~TRAIL_TARGET_PX on the current view. */
  private trailStepUv(): number {
    const canvas = this.map?.getCanvas()
    const w = Math.max(1, canvas?.width ?? 1440)
    const du = Math.max(1e-4, this.viewUv[2] - this.viewUv[0])
    const speedScale = this.speed / WIND_SPEED_GLOBAL
    const target = this.kind === 'ocean' ? OCEAN_TARGET_PX : TRAIL_TARGET_PX * speedScale
    return target / (w / du)
  }

  private viewLonSpan(): number {
    const map = this.map
    if (!map) return this.wrap ? 360 : Math.abs(this.bbox[2] - this.bbox[0])
    try {
      const b = map.getBounds()
      return Math.max(8, Math.abs(b.getEast() - b.getWest()))
    } catch {
      return this.wrap ? 360 : Math.abs(this.bbox[2] - this.bbox[0])
    }
  }

  private syncViewWindow() {
    const map = this.map
    if (!map) {
      this.viewUv = [0, 0, 1, 1]
      return
    }
    try {
      const b = map.getBounds()
      this.viewUv = fieldViewUv(
        { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        this.bbox,
      )
    } catch {
      this.viewUv = [0, 0, 1, 1]
    }
  }

  private syncRibbonFromView() {
    const look = KIND_LOOK[this.kind]
    const span = this.viewLonSpan()
    if (this.kind === 'ocean') {
      this.ribbonDeg = look.ribbonDeg * (span > 80 ? 4.2 : 1)
      this.ribbonPx = look.ribbonPx
    } else if (this.kind === 'precip') {
      this.ribbonDeg = look.ribbonDeg * Math.min(1.6, Math.max(0.7, span / 70))
      this.speed = look.speed
    } else if (this.kind === 'wind') {
      this.ribbonDeg = look.ribbonDeg * Math.min(2.2, Math.max(0.65, span / 95))
      this.speed = span < 140 ? WIND_SPEED_DESK : WIND_SPEED_GLOBAL
    }
  }

  private captureProj(args: unknown) {
    const parsed = parseRenderArgs(args)
    this.proj = parsed.proj
    const g = this.gl
    if (g && parsed.shaderData && parsed.shaderData.variantName !== this.shaderVariant) {
      this.rebuildProjected(g, parsed.shaderData)
    }
  }

  private reseed(g: GL) {
    if (!this.ptex0 || !this.ptex1) return
    this.syncViewWindow()
    const seed = seedParticles(PARTICLE_TEX.width, PARTICLE_TEX.height, this.viewUv)
    g.bindTexture(g.TEXTURE_2D, this.ptex0)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, PARTICLE_TEX.width, PARTICLE_TEX.height, 0, g.RGBA, g.UNSIGNED_BYTE, seed)
    g.bindTexture(g.TEXTURE_2D, this.ptex1)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, PARTICLE_TEX.width, PARTICLE_TEX.height, 0, g.RGBA, g.UNSIGNED_BYTE, seed)
  }

  private rebuildProjected(g: GL, shaderData: ShaderData) {
    try {
      const draw = program(g, makeDrawVS(shaderData.vertexShaderPrelude, shaderData.define), DRAW_FS)
      const line = program(g, makeLineVS(shaderData.vertexShaderPrelude, shaderData.define), LINE_FS)
      const scalar = program(g, makeQuadGeoVS(shaderData.vertexShaderPrelude, shaderData.define), SCALAR_FS)
      if (this.drawProg) g.deleteProgram(this.drawProg)
      if (this.lineProg) g.deleteProgram(this.lineProg)
      if (this.scalarProg) g.deleteProgram(this.scalarProg)
      this.drawProg = draw
      this.lineProg = line
      this.scalarProg = scalar
      this.shaderVariant = shaderData.variantName
    } catch (err) {
      console.warn('[aether-particles] projectTile shader failed, keep previous program', err)
    }
  }

  private bindProjection(g: GL, prog: WebGLProgram, matrix: Float32Array | number[]) {
    const p = this.proj
    g.uniformMatrix4fv(g.getUniformLocation(prog, 'u_projection_matrix'), false, p?.mainMatrix ?? matrix)
    if (p?.tileMercatorCoords) {
      g.uniform4f(
        g.getUniformLocation(prog, 'u_projection_tile_mercator_coords'),
        p.tileMercatorCoords[0],
        p.tileMercatorCoords[1],
        p.tileMercatorCoords[2],
        p.tileMercatorCoords[3],
      )
    }
    if (p?.clippingPlane) {
      g.uniform4f(
        g.getUniformLocation(prog, 'u_projection_clipping_plane'),
        p.clippingPlane[0],
        p.clippingPlane[1],
        p.clippingPlane[2],
        p.clippingPlane[3],
      )
    }
    if (p?.projectionTransition != null) {
      g.uniform1f(g.getUniformLocation(prog, 'u_projection_transition'), p.projectionTransition)
    }
    if (p?.fallbackMatrix) {
      g.uniformMatrix4fv(g.getUniformLocation(prog, 'u_projection_fallback_matrix'), false, p.fallbackMatrix)
    }
  }

  private bindField(g: GL, prog: WebGLProgram) {
    g.uniform4f(g.getUniformLocation(prog, 'u_bbox'), this.bbox[0], this.bbox[1], this.bbox[2], this.bbox[3])
  }

  private ensureTrail(g: GL, w: number, h: number) {
    if (this.trail0 && this.trail1 && this.trailW === w && this.trailH === h) return
    if (this.trail0) g.deleteTexture(this.trail0)
    if (this.trail1) g.deleteTexture(this.trail1)
    this.trail0 = createRgbaTex(g, w, h, null, g.LINEAR)
    this.trail1 = createRgbaTex(g, w, h, null, g.LINEAR)
    this.trailW = w
    this.trailH = h
    this.clearTrail()
  }

  private clearTrail() {
    const g = this.gl
    if (!g || !this.trailFbo || !this.trail0 || !this.trail1) return
    const prevFb = g.getParameter(g.FRAMEBUFFER_BINDING)
    const prevVp = g.getParameter(g.VIEWPORT) as Int32Array
    g.bindFramebuffer(g.FRAMEBUFFER, this.trailFbo)
    for (const tex of [this.trail0, this.trail1]) {
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
      g.viewport(0, 0, this.trailW || 2, this.trailH || 2)
      g.clearColor(0, 0, 0, 0)
      g.clear(g.COLOR_BUFFER_BIT)
    }
    g.bindFramebuffer(g.FRAMEBUFFER, prevFb)
    g.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3])
  }

  private stampTrail(
    g: GL,
    matrix: Float32Array | number[],
    count: number,
    mapFb: unknown,
    mapVp: Int32Array,
  ) {
    if (!this.fadeProg || !this.trailFbo || !this.quadBuf) return
    const canvas = this.map?.getCanvas()
    if (!canvas) return
    this.ensureTrail(g, canvas.width, canvas.height)
    if (!this.trail0 || !this.trail1) return
    g.bindFramebuffer(g.FRAMEBUFFER, this.trailFbo)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.trail1, 0)
    g.viewport(0, 0, this.trailW, this.trailH)
    g.disable(g.DEPTH_TEST)
    g.disable(g.BLEND)
    g.useProgram(this.fadeProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.trail0)
    g.uniform1i(g.getUniformLocation(this.fadeProg, 'u_tex'), 0)
    const moving = !!this.map?.isMoving()
    g.uniform1f(g.getUniformLocation(this.fadeProg, 'u_fade'), moving ? 0 : TRAIL_FADE)
    g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf)
    g.enableVertexAttribArray(0)
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    g.disableVertexAttribArray(0)
    if (!moving) this.drawParticles(g, matrix, count)
    const tmp = this.trail0
    this.trail0 = this.trail1
    this.trail1 = tmp
    g.bindFramebuffer(g.FRAMEBUFFER, mapFb as WebGLFramebuffer | null)
    g.viewport(mapVp[0], mapVp[1], mapVp[2], mapVp[3])
  }

  private blitTrail(g: GL) {
    if (!this.blitProg || !this.trail0 || !this.quadBuf) return
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    g.disable(g.DEPTH_TEST)
    g.useProgram(this.blitProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.trail0)
    g.uniform1i(g.getUniformLocation(this.blitProg, 'u_tex'), 0)
    g.uniform1f(g.getUniformLocation(this.blitProg, 'u_gain'), TRAIL_GAIN)
    g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf)
    g.enableVertexAttribArray(0)
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    g.disableVertexAttribArray(0)
  }

  private updateParticles(g: GL) {
    if (!this.updateProg || !this.fbo || !this.ptex0 || !this.ptex1 || !this.quadBuf) return
    const prevFb = g.getParameter(g.FRAMEBUFFER_BINDING)
    const prevVp = g.getParameter(g.VIEWPORT) as Int32Array
    g.bindFramebuffer(g.FRAMEBUFFER, this.fbo)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.ptex1, 0)
    g.viewport(0, 0, PARTICLE_TEX.width, PARTICLE_TEX.height)
    g.disable(g.BLEND)
    g.disable(g.DEPTH_TEST)
    g.useProgram(this.updateProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.ptex0)
    g.uniform1i(g.getUniformLocation(this.updateProg, 'u_particles'), 0)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, this.windTex)
    g.uniform1i(g.getUniformLocation(this.updateProg, 'u_wind'), 1)
    g.uniform2f(g.getUniformLocation(this.updateProg, 'u_particle_res'), PARTICLE_TEX.width, PARTICLE_TEX.height)
    g.uniform2f(g.getUniformLocation(this.updateProg, 'u_wind_min'), this.uMin, this.vMin)
    g.uniform2f(g.getUniformLocation(this.updateProg, 'u_wind_max'), this.uMax, this.vMax)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_rand_seed'), Math.random())
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_speed'), this.speed * this.speedMul)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_advect'), ADVECT_STEP)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_step'), this.trailStepUv())
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_speed_ref'), this.speedRef)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_uv_scale'), this.uvScale)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_drop_rate'), this.drop)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_wrap'), this.wrap)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_motion'), this.kind === 'precip' ? 1 : 0)
    g.uniform1f(g.getUniformLocation(this.updateProg, 'u_wet_min'), 0.07)
    g.uniform4f(
      g.getUniformLocation(this.updateProg, 'u_view'),
      this.viewUv[0],
      this.viewUv[1],
      this.viewUv[2],
      this.viewUv[3],
    )
    g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf)
    g.enableVertexAttribArray(0)
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    g.disableVertexAttribArray(0)
    const tmp = this.ptex0
    this.ptex0 = this.ptex1
    this.ptex1 = tmp
    g.bindFramebuffer(g.FRAMEBUFFER, prevFb)
    g.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3])
  }

  private drawParticles(g: GL, matrix: Float32Array | number[], count: number) {
    if (!this.drawProg) return
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    g.disable(g.DEPTH_TEST)
    g.disableVertexAttribArray(0)
    g.useProgram(this.drawProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.ptex0)
    g.uniform1i(g.getUniformLocation(this.drawProg, 'u_particles'), 0)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, this.windTex)
    g.uniform1i(g.getUniformLocation(this.drawProg, 'u_wind'), 1)
    g.uniform2f(g.getUniformLocation(this.drawProg, 'u_particle_res'), PARTICLE_TEX.width, PARTICLE_TEX.height)
    this.bindProjection(g, this.drawProg, matrix)
    this.bindField(g, this.drawProg)
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_size'), this.size)
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_count'), count)
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_wrap'), this.wrap)
    g.uniform2f(g.getUniformLocation(this.drawProg, 'u_wind_min'), this.uMin, this.vMin)
    g.uniform2f(g.getUniformLocation(this.drawProg, 'u_wind_max'), this.uMax, this.vMax)
    g.uniform4f(g.getUniformLocation(this.drawProg, 'u_color'), this.color[0], this.color[1], this.color[2], this.color[3])
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_style'), this.style === 'currents' ? 1 : 0)
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_speed_ref'), this.speedRef)
    g.uniform1f(g.getUniformLocation(this.drawProg, 'u_kind'), kindCode(this.kind))
    g.drawArrays(g.POINTS, 0, count)
  }

  private drawRibbons(g: GL, matrix: Float32Array | number[], count: number) {
    if (!this.lineProg || !this.ptex0) return
    const ribbonCount = count
    const canvas = this.map!.getCanvas()
    g.enable(g.BLEND)
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)
    g.disable(g.DEPTH_TEST)
    g.disableVertexAttribArray(0)
    g.useProgram(this.lineProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.ptex0)
    g.uniform1i(g.getUniformLocation(this.lineProg, 'u_particles'), 0)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, this.windTex)
    g.uniform1i(g.getUniformLocation(this.lineProg, 'u_wind'), 1)
    g.uniform2f(g.getUniformLocation(this.lineProg, 'u_particle_res'), PARTICLE_TEX.width, PARTICLE_TEX.height)
    g.uniform2f(g.getUniformLocation(this.lineProg, 'u_wind_min'), this.uMin, this.vMin)
    g.uniform2f(g.getUniformLocation(this.lineProg, 'u_wind_max'), this.uMax, this.vMax)
    this.bindProjection(g, this.lineProg, matrix)
    this.bindField(g, this.lineProg)
    g.uniform2f(g.getUniformLocation(this.lineProg, 'u_resolution'), canvas.width, canvas.height)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_count'), ribbonCount)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_ribbon_deg'), this.ribbonDeg)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_ribbon_px'), this.ribbonPx)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_size'), this.size)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_min_trail'), this.size * (this.wrap ? 16 : 6.5))
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_wrap'), this.wrap)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_style'), this.style === 'currents' ? 1 : 0)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_speed_ref'), this.speedRef)
    g.uniform1f(g.getUniformLocation(this.lineProg, 'u_kind'), kindCode(this.kind))
    g.uniform4f(g.getUniformLocation(this.lineProg, 'u_color'), this.color[0], this.color[1], this.color[2], this.color[3])
    g.drawArrays(g.TRIANGLES, 0, ribbonCount * 6)
  }

  private drawScalar(g: GL, matrix: Float32Array | number[]) {
    if (!this.scalarProg) return
    const lonSeg = this.wrap ? 144 : 48
    const latSeg = this.wrap ? 72 : 32
    const mode =
      this.overlay === 'precip' ? 1 : this.overlay === 'wind' ? 2 : this.overlay === 'ocean' ? 3 : 0
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
    g.disable(g.DEPTH_TEST)
    g.disableVertexAttribArray(0)
    g.useProgram(this.scalarProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, this.windTex)
    g.uniform1i(g.getUniformLocation(this.scalarProg, 'u_wind'), 0)
    this.bindProjection(g, this.scalarProg, matrix)
    this.bindField(g, this.scalarProg)
    g.uniform2f(g.getUniformLocation(this.scalarProg, 'u_grid'), lonSeg, latSeg)
    g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_mode'), mode)
    g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_hatch'), 0)
    g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_wrap'), this.wrap)
    g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_time'), performance.now() * 0.001)
    const curtain =
      this.kind === 'temp'
        ? CURTAIN_ALPHA.temp
        : this.kind === 'ocean'
          ? CURTAIN_ALPHA.ocean
          : CURTAIN_ALPHA.wind
    g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_alpha'), curtain)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, this.lutTex)
    g.uniform1i(g.getUniformLocation(this.scalarProg, 'u_lut'), 1)
    const shifts = this.wrap ? [-360, 0, 360] : [0]
    for (const shift of shifts) {
      g.uniform1f(g.getUniformLocation(this.scalarProg, 'u_lon_shift'), shift)
      g.drawArrays(g.TRIANGLES, 0, lonSeg * latSeg * 6)
    }
  }
}

type ProjectionPack = {
  mainMatrix: Float32Array | number[]
  tileMercatorCoords?: [number, number, number, number]
  clippingPlane?: [number, number, number, number]
  projectionTransition?: number
  fallbackMatrix?: Float32Array | number[]
}

type ShaderData = { variantName: string; vertexShaderPrelude: string; define: string }

function parseRenderArgs(args: unknown): { proj: ProjectionPack | null; shaderData: ShaderData | null } {
  if (!args) return { proj: null, shaderData: null }
  if (Array.isArray(args) || args instanceof Float32Array) {
    return { proj: { mainMatrix: args as number[] }, shaderData: null }
  }
  const a = args as {
    defaultProjectionData?: ProjectionPack
    modelViewProjectionMatrix?: Float32Array | number[]
    shaderData?: ShaderData
  }
  const proj = a.defaultProjectionData
    ? a.defaultProjectionData
    : a.modelViewProjectionMatrix
      ? { mainMatrix: a.modelViewProjectionMatrix }
      : null
  return { proj, shaderData: a.shaderData ?? null }
}
