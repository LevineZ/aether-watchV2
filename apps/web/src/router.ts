import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUiStore, type PageId } from '@/stores/ui'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/global' },
    { path: '/global', name: 'global', meta: { page: 'global' as PageId }, component: { template: '<div/>' } },
    { path: '/desk', name: 'desk', meta: { page: 'desk' as PageId }, component: { template: '<div/>' } },
    { path: '/forecast', redirect: '/desk' },
    { path: '/regional', name: 'regional', meta: { page: 'regional' as PageId }, component: { template: '<div/>' } },
    { path: '/about', name: 'about', meta: { page: 'about' as PageId }, component: { template: '<div/>' } },
    { path: '/:pathMatch(.*)*', redirect: '/global' },
  ] as RouteRecordRaw[],
})

router.beforeEach((to) => {
  const page = (to.meta.page as PageId | undefined) ?? 'global'
  const ui = useUiStore()
  if (ui.page !== page) ui.switchPage(page)
})
