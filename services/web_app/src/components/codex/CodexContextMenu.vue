<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

export interface MenuItem {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
  destructive?: boolean
}

interface Props {
  show: boolean
  x: number
  y: number
  items: MenuItem[]
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const menuRef = ref<HTMLElement>()

function handleItemClick(item: MenuItem) {
  if (!item.disabled) {
    item.action()
    emit('update:show', false)
  }
}

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('update:show', false)
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      document.addEventListener('click', handleClickOutside)
    } else {
      document.removeEventListener('click', handleClickOutside)
    }
  },
)

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu-fade">
      <div
        v-if="show"
        ref="menuRef"
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px` }"
      >
        <button
          v-for="(item, index) in items"
          :key="index"
          class="menu-item"
          :class="{ disabled: item.disabled, destructive: item.destructive }"
          :disabled="item.disabled"
          @click="handleItemClick(item)"
        >
          <span class="menu-item-label">{{ item.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-subtle);
  border-radius: 0.5rem;
  box-shadow: 0 0.625rem 0.9375rem -0.1875rem var(--color-modal-shadow);
  padding: 0.25rem;
  min-width: 11.25rem;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  color: var(--color-foreground);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.menu-item:hover:not(.disabled) {
  background: var(--color-overlay-subtle);
}

.menu-item.destructive {
  color: var(--color-error);
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item-label {
  flex: 1;
}

.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
  transition: opacity 0.1s ease-in-out;
}

.context-menu-fade-enter-from,
.context-menu-fade-leave-to {
  opacity: 0;
}
</style>
