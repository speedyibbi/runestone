<script lang="ts" setup>
/**
 * Throwaway, unstyled host that proves kernel declarations render before any design
 * exists. It attaches the keymap listener (the "host" step deferred from Phase 3),
 * renders the contribution registries, the notification queue and the dialog stack,
 * and offers dev buttons to exercise notify/dialog by hand. Deleted in Phase 11 once
 * the real design renders these surfaces.
 */
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useKernel } from '@/kernel/kernel'
import type { DialogRequest } from '@/kernel/dialog'

const router = useRouter()
const session = useSessionStore()
const kernel = useKernel()

const notify = kernel.notify
const dialog = kernel.dialog

const codex = computed(() => session.getCurrentCodex())

// Reactive views over the one generic contribution registry (empty until Phase 6).
const views = computed(() => kernel.contributions.list('view'))
const actions = computed(() => kernel.contributions.list('action'))
const indicators = computed(() => kernel.contributions.list('indicator'))

// Per-request prompt text, keyed by dialog id.
const promptText = reactive<Record<string, string>>({})

// Union-accepting helpers so the template never touches kind-specific fields directly.
function dialogMessage(req: DialogRequest): string {
  return req.kind === 'open' ? '' : req.options.message
}
function answerConfirm(req: DialogRequest, value: boolean) {
  if (req.kind === 'confirm') req.resolve(value)
}
function submitPrompt(req: DialogRequest) {
  if (req.kind === 'prompt') req.resolve(promptText[req.id] ?? '')
}
function dismissDialog(req: DialogRequest) {
  if (req.kind === 'confirm') req.resolve(false)
  else if (req.kind === 'prompt') req.resolve(null)
  else req.resolve()
}

async function demoConfirm() {
  const ok = await dialog.confirm({ message: 'Confirm this action?' })
  notify.info(`confirm → ${ok}`)
}
async function demoPrompt() {
  const value = await dialog.prompt({ message: 'Type something:' })
  notify.info(`prompt → ${value === null ? 'cancelled' : value}`)
}

// Host step: start listening for keyboard shortcuts; detach on unmount.
let detach: (() => void) | undefined
onMounted(() => {
  detach = kernel.keymap.attach(window)
})
onUnmounted(() => detach?.())

function goToCodexes() {
  router.push('/codexes')
}
</script>

<template>
  <main>
    <header>
      <h1>Dev Scaffold</h1>
      <p v-if="codex">
        <strong>{{ codex.title }}</strong> <small>({{ codex.uuid }})</small>
      </p>
      <p v-else>No codex open.</p>
      <button @click="goToCodexes">← Back to codexes</button>
    </header>

    <section>
      <h2>Dev controls</h2>
      <button @click="notify.info('info message')">notify.info</button>
      <button @click="notify.success('success message')">notify.success</button>
      <button @click="notify.warn('warn message')">notify.warn</button>
      <button @click="notify.error('error message')">notify.error</button>
      <button @click="demoConfirm">dialog.confirm</button>
      <button @click="demoPrompt">dialog.prompt</button>
    </section>

    <section>
      <h2>Notifications ({{ notify.queue.length }})</h2>
      <ul>
        <li v-for="n in notify.queue" :key="n.id">
          <strong>{{ n.level }}</strong>: {{ n.message }}
          <button @click="notify.dismiss(n.id)">dismiss</button>
        </li>
      </ul>
    </section>

    <section>
      <h2>Dialogs ({{ dialog.stack.length }})</h2>
      <ul>
        <li v-for="req in dialog.stack" :key="req.id">
          <template v-if="req.kind === 'confirm'">
            {{ dialogMessage(req) }}
            <button @click="answerConfirm(req, true)">OK</button>
            <button @click="answerConfirm(req, false)">Cancel</button>
          </template>
          <template v-else-if="req.kind === 'prompt'">
            {{ dialogMessage(req) }}
            <input v-model="promptText[req.id]" />
            <button @click="submitPrompt(req)">OK</button>
            <button @click="dismissDialog(req)">Cancel</button>
          </template>
          <template v-else>
            [open dialog]
            <button @click="dismissDialog(req)">close</button>
          </template>
        </li>
      </ul>
    </section>

    <section>
      <h2>Views ({{ views.length }})</h2>
      <ul>
        <li v-for="c in views" :key="c.id">{{ c.id }}</li>
      </ul>
    </section>
    <section>
      <h2>Actions ({{ actions.length }})</h2>
      <ul>
        <li v-for="c in actions" :key="c.id">{{ c.id }}</li>
      </ul>
    </section>
    <section>
      <h2>Indicators ({{ indicators.length }})</h2>
      <ul>
        <li v-for="c in indicators" :key="c.id">{{ c.id }}</li>
      </ul>
    </section>
  </main>
</template>
