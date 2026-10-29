import { defineStore } from 'pinia'
import {
  applyMaskContract,
  assertGlobalPack,
  inferKind,
  isGlobalDemoPack,
  loadDemo,
  loadLive,
  parseNcFile,
  fieldStats,
  uvRange,
  PAGE_DEFAULT_KIND,
  PAGE_PACK,
  packForKind,
  type DemoPackId,
  type FieldFrame,
  type FieldKind,
  type FieldStats,
  type NcUploadError,
} from '@aether/field'
import { lockBounds, mapRuntime, fitFieldView } from '@/map/runtime'
import { useUiStore, type PageId } from './ui'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export const useFieldStore = defineStore('field', {
  state: () => ({
    cache: {} as Record<string, FieldFrame>,
    activePack: PAGE_PACK.global as DemoPackId | 'upload',
    frame: null as FieldFrame | null,
    stats: null as FieldStats | null,
    status: 'idle' as Status,
    error: '' as string,
    ncStatus: '' as string,
    ncError: '' as string,
    uploaded: false,
    pageSeq: 0,
    /** 页:要素 → 缺包 / 404，灰芯片，禁止回退区域包。 */
    missing: {} as Record<string, boolean>,
  }),
  getters: {
    badgeAlwaysDemo: (s) => !(s.frame?.meta?.source === 'live'),
    particleTarget: (s) => (s.frame ? 25_000 : 0),
  },
  actions: {
    missKey(page: PageId, kind: FieldKind) {
      return `${page}:${kind}`
    },
    isKindMissing(page: PageId, kind: FieldKind) {
      if (page === 'about') return true
      if (!packForKind(page, kind)) return true
      return !!this.missing[this.missKey(page, kind)]
    },
    markMissing(page: PageId, kind: FieldKind, yes: boolean) {
      this.missing[this.missKey(page, kind)] = yes
    },
    bindToGpu(frame: FieldFrame | null, packId?: DemoPackId | 'upload') {
      const ui = useUiStore()
      const pack = packId ?? this.activePack
      if (frame) applyMaskContract(frame)
      if (frame && ui.page === 'global') {
        try {
          assertGlobalPack(String(pack), frame)
        } catch (e) {
          console.warn('[aether] FieldFrame reject', {
            pack,
            nx: frame.nx,
            ny: frame.ny,
            bbox: [...frame.bbox],
            reason: e instanceof Error ? e.message : String(e),
          })
          throw e
        }
      }
      if (packId !== undefined) this.activePack = packId
      this.frame = frame
      this.stats = frame ? fieldStats(frame) : null
      if (frame) {
        const kind = inferKind(frame)
        ui.setKind(kind)
        const uv = uvRange(frame)
        console.info('[aether] FieldFrame', {
          pack: this.activePack,
          nx: frame.nx,
          ny: frame.ny,
          bbox: [...frame.bbox],
          uvRange: { u: uv.u, v: uv.v },
          kind,
          hasMask: !!frame.mask,
        })
      }
      mapRuntime.particles?.setFrame(frame)
      lockBounds(ui.page === 'regional' ? (frame?.bbox ?? null) : null, ui.page)
      if (frame && (ui.page === 'desk' || ui.page === 'global')) {
        fitFieldView(ui.page)
      }
    },
    dropGlobalBind() {
      this.bindToGpu(null)
    },
    async loadIntoCache(packId: DemoPackId) {
      if (this.cache[packId]) return this.cache[packId]
      // ocean → OSCAR 6h; wind/temp/precip → Open-Meteo 6h (loadLive)
      const frame = await loadLive(packId)
      this.cache[packId] = frame
      return frame
    },
    async ensurePack(packId: DemoPackId) {
      const ui = useUiStore()
      if (ui.page === 'global' && !isGlobalDemoPack(packId)) {
        throw new Error(`Global 禁止绑定非全球包 ${packId}`)
      }
      if (!this.cache[packId]) {
        this.status = 'loading'
        this.error = ''
      }
      try {
        const frame = await this.loadIntoCache(packId)
        this.bindToGpu(frame, packId)
        this.status = 'ready'
        this.error = ''
        return frame
      } catch (e) {
        this.status = 'error'
        this.error = e instanceof Error ? e.message : String(e)
        throw e
      }
    },
    async showPage(page: PageId) {
      const seq = ++this.pageSeq
      const ui = useUiStore()
      if (page === 'about') {
        if (seq !== this.pageSeq) return
        const g = this.cache[PAGE_PACK.global]
        if (g) {
          try {
            assertGlobalPack(PAGE_PACK.global, g)
            mapRuntime.particles?.setFrame(g)
          } catch {
            mapRuntime.particles?.setFrame(null)
          }
        } else {
          mapRuntime.particles?.setFrame(null)
        }
        return
      }
      if (page === 'regional' && this.uploaded && this.cache.upload) {
        if (seq !== this.pageSeq) return
        this.bindToGpu(this.cache.upload, 'upload')
        this.status = 'ready'
        return
      }
      if (page === 'regional' && !this.uploaded) {
        if (seq !== this.pageSeq) return
        ui.setKind('ocean')
        this.bindToGpu(null)
        this.status = 'idle'
        this.error = ''
        return
      }
      const kind = PAGE_DEFAULT_KIND[page]
      ui.setKind(kind)
      const pack = packForKind(page, kind)
      if (!pack) {
        this.markMissing(page, kind, true)
        this.status = 'error'
        this.error = '来源缺失'
        this.bindToGpu(null)
        return
      }
      this.status = 'loading'
      this.error = ''
      try {
        const frame = await this.loadIntoCache(pack)
        if (seq !== this.pageSeq) return
        this.bindToGpu(frame, pack)
        this.status = 'ready'
        this.markMissing(page, kind, false)
      } catch (e) {
        if (seq !== this.pageSeq) return
        this.markMissing(page, kind, true)
        this.status = 'error'
        this.error = e instanceof Error ? e.message : String(e)
        if (page === 'global') this.dropGlobalBind()
      }
    },
    async selectKind(kind: FieldKind) {
      const ui = useUiStore()
      if (ui.page === 'about') return
      if (ui.page === 'regional' && !this.uploaded) {
        ui.uploadOpen = true
        return
      }
      const prev = ui.kind
      const pack = packForKind(ui.page, kind)
      if (!pack) {
        this.markMissing(ui.page, kind, true)
        return
      }
      ui.setKind(kind)
      try {
        await this.ensurePack(pack)
        this.markMissing(ui.page, kind, false)
      } catch (e) {
        this.markMissing(ui.page, kind, true)
        ui.setKind(prev)
        const keep = packForKind(ui.page, prev)
        const keepFrame = keep ? this.cache[keep] : undefined
        if (keep && keepFrame) {
          try {
            this.bindToGpu(keepFrame, keep)
            this.status = 'ready'
            this.error = ''
          } catch {
            this.status = 'error'
            this.error = e instanceof Error ? e.message : String(e)
            if (ui.page === 'global') this.dropGlobalBind()
          }
        } else {
          this.error = e instanceof Error ? e.message : String(e)
          this.status = 'error'
          if (ui.page === 'global') this.dropGlobalBind()
        }
      }
    },
    preloadIdle() {
      const rest: DemoPackId[] = [
        'global/ocean',
        'global/temp',
        'global/precip',
        'china/wind',
        'china/temp',
        'china/precip',
        'regional/currents',
        'regional/temp',
        'regional/precip',
      ]
      const run = async () => {
        for (const id of rest) {
          if (!this.cache[id]) {
            try {
              this.cache[id] = await loadLive(id)
            } catch {
              if (isGlobalDemoPack(id)) {
                const kind = inferKind({
                  packId: id,
                  meta: { source: 'demo', vars: [], units: '' },
                })
                this.markMissing('global', kind, true)
              }
            }
          }
        }
      }
      window.setTimeout(() => void run(), 600)
    },
    async uploadNc(file: File, bbox: [number, number, number, number]) {
      this.ncError = ''
      this.ncStatus = 'reading'
      try {
        const frame = applyMaskContract(
          await parseNcFile(file, bbox, (s) => {
            this.ncStatus = s
          }),
        )
        this.bindToGpu(frame, 'upload')
        this.cache.upload = frame
        this.uploaded = true
        this.status = 'ready'
        this.ncStatus = 'done'
      } catch (e) {
        const err = e as NcUploadError
        this.ncStatus = ''
        this.ncError = err.message || '解析失败'
      }
    },
    clearUpload() {
      delete this.cache.upload
      this.uploaded = false
      this.ncError = ''
      this.ncStatus = ''
      void this.ensurePack(PAGE_PACK.regional)
    },
  },
})
