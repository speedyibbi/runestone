<script lang="ts" setup>
import { onMounted } from 'vue'
import FileService from '@/services/file'

onMounted(async () => {
  const file = await FileService.upsertFile('test.txt')
  console.log(file)
})
</script>

<template>
  <main>
    <img src="/logo.png" alt="logo" />
    <h1>Runestone</h1>
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

h1 {
  color: #ccaaff;
  font-size: 4rem;
  font-family: 'Passero One', serif;
  font-weight: 900;
  filter: drop-shadow(0 0 0.1rem #ccaaff);
}

img {
  width: 200px;
  filter: drop-shadow(0 0 0.5rem #ffffff);
  transition: filter 0.5s ease-out;
  animation: float 4s ease-in-out infinite;
}

img:hover {
  filter: drop-shadow(0 0 15rem #ffffff00);
}

@keyframes float {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-16px);
  }
  100% {
    transform: translateY(0);
  }
}
</style>
