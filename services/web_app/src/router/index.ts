import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import AuthPage from '@/pages/AuthPage.vue'
import CodexSelectPage from '@/pages/CodexSelectPage.vue'
import WorkspacePage from '@/pages/WorkspacePage.vue'
import UnsupportedPage from '@/pages/UnsupportedPage.vue'

export const ROUTES = {
  AUTH: 'auth',
  CODEXES: 'codexes',
  WORKSPACE: 'workspace',
  UNSUPPORTED: 'unsupported',
}

const routes = [
  { path: '/', redirect: '/auth' },
  { path: '/auth', name: ROUTES.AUTH, component: AuthPage },
  { path: '/codexes', name: ROUTES.CODEXES, component: CodexSelectPage },
  { path: '/codex/:codexId', name: ROUTES.WORKSPACE, component: WorkspacePage },
  { path: '/unsupported', name: ROUTES.UNSUPPORTED, component: UnsupportedPage },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to, from) => {
  const session = useSessionStore()

  // Authenticated users skip the auth page
  if (to.name === ROUTES.AUTH && session.isActive) {
    return { name: ROUTES.CODEXES }
  }

  // Protected routes require an active session
  if ((to.name === ROUTES.CODEXES || to.name === ROUTES.WORKSPACE) && !session.isActive) {
    return { name: ROUTES.AUTH }
  }

  // Leaving the workspace to a non-workspace route: close the open codex
  if (from.name === ROUTES.WORKSPACE && to.name !== ROUTES.WORKSPACE && session.hasOpenCodex) {
    await session.closeCodex()
  }

  // Entering the workspace: ensure the correct codex is loaded
  if (to.name === ROUTES.WORKSPACE && session.isActive) {
    const codexId = to.params.codexId as string
    if (session.getCurrentCodex()?.uuid !== codexId) {
      // Close any other open codex before opening the requested one
      if (session.hasOpenCodex) {
        await session.closeCodex()
      }
      try {
        await session.openCodex(codexId)
      } catch {
        return { name: ROUTES.CODEXES }
      }
    }
  }
})

export default router
