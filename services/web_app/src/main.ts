import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'

// Import seeder for browser console access (development only)
if (import.meta.env.DEV) {
  import('@/scripts/seed')
}

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
