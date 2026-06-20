import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import router from '@/router'
import { createKernel } from '@/kernel/kernel'
import { registerCoreModules, registerFeatureModules } from '@/kernel/register'

// Import seeder for browser console access (development only)
if (import.meta.env.DEV) {
  import('@/scripts/seed')
}

const app = createApp(App)

// Plugin order matters
app.use(createPinia())

const kernel = createKernel()
app.use(kernel)
registerCoreModules(kernel)
registerFeatureModules(kernel)
void kernel.modules.setupAll()

app.use(router)

app.mount('#app')
