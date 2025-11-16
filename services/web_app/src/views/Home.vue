<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useLookupStore } from '@/stores/lookup'
import FileService from '@/services/l1-storage/file'

const lookupStore = useLookupStore()
const filePath = ref('')
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadMessage = ref('')

onMounted(() => {
  lookupStore.setLookupKey('test')
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const uploadFile = async () => {
  if (!filePath.value || !selectedFile.value) {
    uploadMessage.value = 'Please provide both a file path and select a file'
    return
  }

  uploading.value = true
  uploadMessage.value = 'Uploading...'

  try {
    const result = await FileService.upsertFile(filePath.value, selectedFile.value)
    uploadMessage.value = `File uploaded successfully!`
    console.log('Upload result:', result)

    // Reset form
    filePath.value = ''
    selectedFile.value = null
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  } catch (error) {
    uploadMessage.value = `Upload failed: ${error}`
    console.error('Upload error:', error)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <main>
    <div class="content">
      <img src="/logo.png" alt="logo" />
      <h1>Runestone</h1>

      <div class="upload-form">
        <h2>File Upload</h2>
        <div class="form-group">
          <label for="filePath">File Path:</label>
          <input
            id="filePath"
            v-model="filePath"
            type="text"
            placeholder="e.g., documents/example.txt"
            :disabled="uploading"
          />
        </div>

        <div class="form-group">
          <label for="fileInput">Select File:</label>
          <input id="fileInput" type="file" @change="handleFileSelect" :disabled="uploading" />
          <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
        </div>

        <button
          @click="uploadFile"
          :disabled="uploading || !filePath || !selectedFile"
          class="upload-btn"
        >
          {{ uploading ? 'Uploading...' : 'Upload File' }}
        </button>

        <p
          v-if="uploadMessage"
          class="message"
          :class="{ error: uploadMessage.includes('failed') }"
        >
          {{ uploadMessage }}
        </p>
      </div>
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

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

h1 {
  color: #ccaaff;
  font-size: 4rem;
  font-family: 'Passero One', serif;
  font-weight: 900;
  filter: drop-shadow(0 0 0.1rem #ccaaff);
}

h2 {
  color: #ccaaff;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  text-align: center;
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

.upload-form {
  background-color: rgba(204, 170, 255, 0.1);
  border: 2px solid #ccaaff;
  border-radius: 12px;
  padding: 2rem;
  min-width: 400px;
  backdrop-filter: blur(10px);
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  color: #ccaaff;
  font-size: 0.9rem;
  font-weight: 600;
}

input[type='text'],
input[type='file'] {
  padding: 0.75rem;
  border: 1px solid #ccaaff;
  border-radius: 6px;
  background-color: rgba(0, 0, 21, 0.8);
  color: #ffffff;
  font-size: 1rem;
}

input[type='text']:focus {
  outline: none;
  border-color: #ffffff;
  box-shadow: 0 0 10px rgba(204, 170, 255, 0.5);
}

input[type='file']::file-selector-button {
  padding: 0.5rem 1rem;
  background-color: #ccaaff;
  color: #000015;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  margin-right: 1rem;
}

input[type='file']::file-selector-button:hover {
  background-color: #ffffff;
}

input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-name {
  color: #ffffff;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.upload-btn {
  width: 100%;
  padding: 1rem;
  background-color: #ccaaff;
  color: #000015;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn:hover:not(:disabled) {
  background-color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(204, 170, 255, 0.4);
}

.upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  background-color: rgba(170, 255, 170, 0.2);
  color: #aaffaa;
  border: 1px solid #aaffaa;
}

.message.error {
  background-color: rgba(255, 170, 170, 0.2);
  color: #ffaaaa;
  border-color: #ffaaaa;
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
