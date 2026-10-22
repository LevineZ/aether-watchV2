import { defineStore } from 'pinia'
import { mapRuntime, applyCamera } from '@/map/runtime'

export type PageId = 'global' | 'desk' | 'regional' | 'about'
export type Locale = 'zh' | 'en'

export const useUiStore = defineStore('ui', {
  state: () => ({
    page: 'global' as PageId,
    locale: 'zh' as Locale,
    playing: false,
    hour: 0,
    density: 0.48,
    pointSize: 1,
    strength: 1,
    overlay: 'none' as 'none' | 'temp' | 'precip',
    selectedCity: '北京',
    switching: false,
  }),
  actions: {
    /** 切 Tab：停平流、保留 Map 与粒子数量；禁止拆球 + 同步 decode。 */
    switchPage(page: PageId) {
      if (this.page === page) return
      this.switching = true
      mapRuntime.pause()
      this.page = page
      this.playing = false
      if (page !== 'regional') this.overlay = 'none'
      applyCamera(page)
      const p = mapRuntime.particles
      if (p) {
        if (page === 'regional') {
          if (this.overlay === 'none') p.setStyle('currents')
          p.setOverlay(this.overlay)
        } else {
          p.setStyle('wind-fog')
          p.setOverlay('none')
        }
      }
      queueMicrotask(() => {
        this.switching = false
      })
    },
    toggleLocale() {
      this.locale = this.locale === 'zh' ? 'en' : 'zh'
    },
  },
})
