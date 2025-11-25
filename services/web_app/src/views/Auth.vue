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
        placeholder="Enter passphrase"
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
  background-color: #000015;
}

.input-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

input {
  width: 400px;
  padding: 1rem;
  font-size: 1rem;
  border: 2px solid #ccaaff;
  border-radius: 8px;
  background-color: rgba(0, 0, 21, 0.8);
  color: #ffffff;
  text-align: center;
}

input::placeholder {
  color: rgba(204, 170, 255, 0.5);
}

input:focus {
  outline: none;
  border-color: #ffffff;
  box-shadow: 0 0 20px rgba(204, 170, 255, 0.3);
}
</style>
