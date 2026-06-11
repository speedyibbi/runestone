<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()

const codex = computed(() => session.getCurrentCodex())

function goToCodexes() {
  router.push('/codexes')
}
</script>

<template>
  <main>
    <h1>Workspace</h1>
    <template v-if="codex">
      <p><strong>{{ codex.title }}</strong> <small>({{ codex.uuid }})</small></p>
    </template>
    <p v-else>No codex open.</p>
    <button @click="goToCodexes">← Back to codexes</button>
  </main>
</template>
