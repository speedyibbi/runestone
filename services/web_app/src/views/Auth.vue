<script lang="ts" setup>
import { ref } from 'vue'

const passphrase = ref('')

const handleSubmit = () => {
  // TODO: Add authentication logic here
}
</script>

<template>
  <main>
    <div class="input-container">
      <input
        v-model="passphrase"
        type="password"
        placeholder="Passphrase"
        @keyup.enter="handleSubmit"
        autofocus
      />
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-background);
}

.input-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

input {
  width: 35rem;
  padding: 1rem 0;
  font-size: 1.5rem;
  border: none;
  border-bottom: 0.1rem solid var(--color-accent);
  background-color: transparent;
  color: var(--color-foreground);
  text-align: center;
  transition: border-bottom-color 0.2s ease;
}

input::placeholder {
  color: var(--color-accent);
}

input:focus {
  outline: none;
  border-bottom-color: var(--color-foreground);
}
</style>
