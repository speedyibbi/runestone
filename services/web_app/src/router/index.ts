import { createRouter, createWebHistory } from 'vue-router'

import Auth from '@/views/Auth.vue'
import Codex from '@/views/Codex.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      meta: {
        title: 'Unlock Vault',
        description: 'Unlock your vault to access your data',
      },
      component: Auth,
    },
    {
      path: '/',
      name: 'codex',
      meta: {
        title: 'Codex',
        description: 'Your personal knowledge base',
      },
      component: Codex,
    },
  ],
})

export default router
