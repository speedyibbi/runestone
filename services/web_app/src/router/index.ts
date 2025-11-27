import { createRouter, createWebHistory } from 'vue-router'

import Auth from '@/views/Auth.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'auth',
      meta: {
        title: 'Unlock Vault',
        description: 'Unlock your vault to access your data',
      },
      component: Auth,
    },
  ],
})

export default router
