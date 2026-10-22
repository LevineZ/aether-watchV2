import { defineStore } from 'pinia'
import {
  applyMaskContract,
  inferKind,
  loadDemo,
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
import { lockBounds, mapRuntime } from '@/map/runtime'
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
  }),
  getters: {
    badgeAlwaysDemo: () => true,
    particleTarget: (s) => (s.frame ? 400_000 : 0),
  },
  actions: {
    bindToGpu(frame: FieldFrame | null) {
      const ui = useUiStore()
      if (frame) applyMaskContract(frame)
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
    },
    async loadIntoCache(packId: DemoPackId) {
      if (this.cache[packId]) return this.cache[packId]
      const frame = await loadDemo(packId)
      this.cache[packId] = frame
      return frame
    },
    async ensurePack(packId: DemoPackId) {
      if (this.cache[packId]) {
        this.activePack = packId
        this.status = 'ready'
        this.error = ''
        this.bindToGpu(this.cache[packId])
        return this.cache[packId]
      }
      this.status = 'loading'
      this.error = ''
      try {
        const frame = await this.loadIntoCache(packId)
        this.activePack = packId
        this.status = 'ready'
        this.bindToGpu(frame)
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
        mapRuntime.particles?.setFrame(this.cache[PAGE_PACK.global] ?? null)
        return
      }
      if (page === 'regional' && this.uploaded && this.cache.upload) {
        if (seq !== this.pageSeq) return
        this.activePack = 'upload'
        this.status = 'ready'
        this.bindToGpu(this.cache.upload)
        return
      }
      const kind = PAGE_DEFAULT_KIND[page]
      ui.setKind(kind)
      const pack = packForKind(page, kind)
      this.status = 'loading'
      this.error = ''
      try {
        const frame = await this.loadIntoCache(pack)
        if (seq !== this.pageSeq) return
        this.activePack = pack
        this.status = 'ready'
        this.bindToGpu(frame)
      } catch (e) {
        if (kind === 'ocean') {
          try {
            const fallback = packForKind(page, 'wind')
            const frame = await this.loadIntoCache(fallback)
            if (seq !== this.pageSeq) return
            ui.setKind('wind')
            this.activePack = fallback
            this.status = 'ready'
            this.bindToGpu(frame)
            return
          } catch {
            /* fall through */
          }
        }
        if (seq !== this.pageSeq) return
        this.status = 'error'
        this.error = e instanceof Error ? e.message : String(e)
      }
    },
    async selectKind(kind: FieldKind) {
      const ui = useUiStore()
      if (ui.page === 'about') return
      ui.setKind(kind)
      const pack = packForKind(ui.page, kind)
      try {
        await this.ensurePack(pack)
      } catch (e) {
        if (kind === 'ocean') {
          ui.setKind('wind')
          await this.ensurePack(packForKind(ui.page, 'wind'))
          return
        }
        this.error = e instanceof Error ? e.message : String(e)
        this.status = 'error'
      }
    },
    preloadIdle() {
      const rest: DemoPackId[] = ['forecast/china', 'regional/currents', 'regional/temp', 'regional/precip']
      const run = async () => {
        for (const id of rest) {
          if (!this.cache[id]) {
            try {
              this.cache[id] = await loadDemo(id)
            } catch {
              /* 预热失败不打断演示 */
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
        this.cache.upload = frame
        this.uploaded = true
        this.activePack = 'upload'
        this.status = 'ready'
        this.bindToGpu(frame)
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
