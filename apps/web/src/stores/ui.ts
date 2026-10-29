import { PAGE_DEFAULT_KIND, type FieldKind } from '@aether/field'
import { defineStore } from 'pinia'
import { mapRuntime, applyCamera, setPlaceLabels } from '@/map/runtime'

export type PageId = 'global' | 'desk' | 'regional' | 'about'
export type Locale = 'zh' | 'en'

function overlayOf(kind: FieldKind): 'none' | 'wind' | 'temp' | 'precip' | 'ocean' {
  if (kind === 'temp' || kind === 'precip' || kind === 'wind' || kind === 'ocean') return kind
  return 'none'
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    page: 'global' as PageId,
    locale: 'zh' as Locale,
    playing: false,
    hour: 0,
    density: 0.48,
    pointSize: 1,
    strength: 1,
    kind: 'wind' as FieldKind,
    overlay: 'wind' as 'none' | 'wind' | 'temp' | 'precip' | 'ocean',
    selectedCity: '北京',
    switching: false,
    labelsOn: true,
    uploadOpen: false,
    layersOpen: true,
  }),
  actions: {
    setKind(kind: FieldKind) {
      this.kind = kind
      this.overlay = overlayOf(kind)
    },
    /** 切 Tab：停平流、保留 Map 与粒子数量；禁止拆球 + 同步 decode。 */
    switchPage(page: PageId) {
      if (this.page === page) return
      this.switching = true
      mapRuntime.pause()
      this.page = page
      this.playing = false
      if (page !== 'about') this.setKind(PAGE_DEFAULT_KIND[page])
      applyCamera(page)
      mapRuntime.particles?.applyKindLook(this.kind)
      queueMicrotask(() => {
        this.switching = false
      })
    },
    toggleLocale() {
      this.locale = this.locale === 'zh' ? 'en' : 'zh'
    },
    toggleLabels() {
      this.labelsOn = !this.labelsOn
      setPlaceLabels(this.labelsOn)
    },
  },
})
