import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
router.isReady().then(() => {
  app.mount('#app')
})
