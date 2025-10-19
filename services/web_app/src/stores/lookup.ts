import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useLookupStore = defineStore('lookup', () => {
  const storedValue = localStorage.getItem('lookup')
  const data = ref<string>(storedValue || '')

  function setLookupKey(key: string) {
    data.value = key
    localStorage.setItem('lookup', key)
  }

  function getLookupKey() {
    return data.value
  }

  return { setLookupKey, getLookupKey }
})
