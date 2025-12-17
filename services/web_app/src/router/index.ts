import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

import Auth from '@/views/Auth.vue'
import CodexSelection from '@/views/CodexSelection.vue'
import Codex from '@/views/Codex.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/select-codex',
    },
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
      path: '/select-codex',
      name: 'select-codex',
      meta: {
        title: 'Select Codex',
        description: 'Choose a codex to work with',
        requiresAuth: true,
      },
      component: CodexSelection,
    },
    {
      path: '/codex/:codexId',
      name: 'codex',
      meta: {
        title: 'Codex',
        description: 'Your personal knowledge base',
        requiresAuth: true,
        requiresCodex: true,
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
    return
  }
   
  if (to.meta.requiresAuth && !sessionStore.isActive) {
    // Redirect to auth if trying to access protected route without session
    next('/auth')
  } else if (to.path === '/auth' && sessionStore.isActive) {
    // Redirect to codex selection if already authenticated
    next('/select-codex')
  } else if (to.meta.requiresCodex && !sessionStore.hasOpenCodex) {
    // Redirect to codex selection if trying to access codex without one open
    next('/select-codex')
  } else {
    next()
  }
})

export default router
