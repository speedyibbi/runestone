import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

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
        requiresAuth: true,
      },
      component: Codex,
    },
  ],
})

// Navigation guard to protect routes
router.beforeEach((to, from, next) => {
  const sessionStore = useSessionStore()

  // if page does not exist, redirect to home
  if (!to.matched.length) {
    next('/')
  }
  
  if (to.meta.requiresAuth && !sessionStore.isActive) {
    // Redirect to auth if trying to access protected route without session
    next('/auth')
  } else if (to.path === '/auth' && sessionStore.isActive) {
    // Redirect to codex if already authenticated
    next('/')
  }
  
  next()
})

export default router
